-- ============================================================================
-- ConnectBounty – Schema v4: Expiry + Payments Foundation
-- ============================================================================
-- Fachliche Essenz:
--   • expire_stale_bounties()  – markiert abgelaufene Bounties atomar
--   • payouts-Tabelle          – dokumentiert Referral-Prämien-Auszahlungen
--   • Stripe-Connect-Tabelle   – speichert Connect-Account-Status pro User
--
-- Designprinzipien:
--   1. Expiry läuft idempotent: wiederholter Aufruf ändert nichts, wenn
--      bereits alle nötigen Rows gesetzt sind.
--   2. payout_status ist strikt geordnet (pending→processing→paid/failed)
--      und durch Trigger gegen Rücksprünge gesichert.
--   3. stripe_connect_accounts speichert NIE rohe API-Keys; nur IDs und
--      öffentliche Metadaten, die zur Fehlerdiagnose nötig sind.
-- ============================================================================

-- ── 1. Expiry-Funktion ───────────────────────────────────────────────────────
-- Markiert alle Bounties, deren expires_at < now() AND status = 'open'
-- auf 'expired'. Wird vom Application-Layer als Lazy-Check aufgerufen,
-- optional auch per Supabase-Scheduled Edge Function / pg_cron.

create or replace function public.expire_stale_bounties()
  returns int   -- Anzahl der aktualisierten Rows (für Monitoring)
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count int;
begin
  with expired as (
    update public.bounties
    set
      status     = 'expired'::public.bounty_status,
      closed_at  = now(),
      updated_at = now()
    where
      status    = 'open'
      and expires_at is not null
      and expires_at < now()
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

-- Keine direkte Nutzer-Ausführung nötig; wird nur aus service-role / Edge
-- Function aufgerufen. Trotzdem explizit revoken:
revoke execute on function public.expire_stale_bounties() from anon, authenticated;

-- ── 2. Audit-Action-Enum erweitern ──────────────────────────────────────────

alter type public.audit_action add value if not exists 'bounty.expired';
alter type public.audit_action add value if not exists 'payout.created';
alter type public.audit_action add value if not exists 'payout.processing';
alter type public.audit_action add value if not exists 'payout.paid';
alter type public.audit_action add value if not exists 'payout.failed';
alter type public.audit_action add value if not exists 'stripe.connect_started';
alter type public.audit_action add value if not exists 'stripe.connect_completed';
alter type public.audit_action add value if not exists 'stripe.connect_revoked';

-- ── 3. Payout-Status-Enum ───────────────────────────────────────────────────

create type public.payout_status as enum (
  'pending',      -- erstellt, noch nicht ans Zahlungssystem übermittelt
  'processing',   -- bei Stripe in Bearbeitung
  'paid',         -- Auszahlung bestätigt
  'failed',       -- Fehler – kann neu gestartet werden
  'cancelled'     -- manuell storniert (z. B. disputed)
);

-- ── 4. Stripe-Connect-Accounts ──────────────────────────────────────────────

create table if not exists public.stripe_connect_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,

  -- Stripe Connect Express Account-ID (acct_...)
  stripe_account_id   text,
  -- Onboarding-Status (laut Stripe)
  onboarding_status   text not null default 'pending'
                      check (onboarding_status in ('pending','onboarding','active','restricted','disabled')),
  -- Ob payouts momentan enabled sind
  payouts_enabled     boolean not null default false,
  -- Ob charges enabled sind
  charges_enabled     boolean not null default false,
  -- Zeitstempel des letzten Stripe-Webhooks
  last_synced_at      timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint stripe_connect_accounts_user_id_key unique (user_id)
);

create trigger stripe_connect_accounts_set_updated_at
  before update on public.stripe_connect_accounts
  for each row execute function public.set_updated_at();

-- RLS
alter table public.stripe_connect_accounts enable row level security;

-- Eigene Daten lesen
create policy stripe_connect_select_own
  on public.stripe_connect_accounts for select
  to authenticated
  using (user_id = auth.uid());

-- Nur service_role darf inserieren/updaten (wird nie direkt vom Client gemacht)
-- → Keine INSERT/UPDATE-Policy für authenticated – Stripe-Webhook + Edge Function
--   laufen als service_role und werden von RLS nicht eingeschränkt.

-- ── 5. Payouts-Tabelle ──────────────────────────────────────────────────────

create table if not exists public.payouts (
  id                    uuid primary key default gen_random_uuid(),

  -- Verknüpfung
  referral_id           uuid not null references public.bounty_referrals(id),
  bounty_id             uuid not null references public.bounties(id),
  referrer_id           uuid not null references public.profiles(id),
  stripe_account_id     text,          -- acct_... zum Zeitpunkt des Transfers

  -- Betrag
  amount                numeric(12,2) not null check (amount > 0),
  currency              char(3)       not null check (currency ~ '^[A-Z]{3}$'),

  -- Status
  status                public.payout_status not null default 'pending',
  stripe_transfer_id    text,          -- tr_... aus Stripe-Response
  stripe_error_code     text,          -- bei status='failed'
  failure_reason        text,

  -- Zeitstempel
  requested_at          timestamptz not null default now(),
  processing_started_at timestamptz,
  paid_at               timestamptz,
  failed_at             timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Pro Referral immer nur ein offener Payout
  constraint payouts_referral_unique unique (referral_id)
);

create trigger payouts_set_updated_at
  before update on public.payouts
  for each row execute function public.set_updated_at();

-- Payout-Status-Transition-Guard
create or replace function public.enforce_payout_transition()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  -- Einmal 'paid', 'cancelled' oder nach mehrfach 'failed' kein Update mehr.
  if old.status in ('paid', 'cancelled') then
    raise exception 'unzulässiger Payout-Übergang: % → %', old.status, new.status
      using errcode = '22023';
  end if;

  -- Erlaubte Übergänge:
  if not (
    (old.status = 'pending'    and new.status in ('processing','cancelled'))
    or (old.status = 'processing' and new.status in ('paid','failed','cancelled'))
    or (old.status = 'failed'   and new.status in ('pending','cancelled'))
  ) then
    raise exception 'unzulässiger Payout-Übergang: % → %', old.status, new.status
      using errcode = '22023';
  end if;

  -- Zeitstempel setzen
  if new.status = 'processing' then new.processing_started_at := now(); end if;
  if new.status = 'paid'       then new.paid_at               := now(); end if;
  if new.status = 'failed'     then new.failed_at             := now(); end if;
  if new.status = 'cancelled'  then new.cancelled_at          := now(); end if;

  return new;
end;
$$;

create trigger payouts_transition_guard
  before update on public.payouts
  for each row
  when (old.status is distinct from new.status)
  execute function public.enforce_payout_transition();

-- RLS
alter table public.payouts enable row level security;

-- Referrer sieht eigene Payouts
create policy payouts_select_own
  on public.payouts for select
  to authenticated
  using (referrer_id = auth.uid());

-- Bounty-Owner sieht Payouts auf seine Bounties
create policy payouts_select_bounty_owner
  on public.payouts for select
  to authenticated
  using (public.owns_bounty(bounty_id));

-- Staff
create policy payouts_select_staff
  on public.payouts for select
  to authenticated
  using (public.has_any_role(array['admin','superadmin','moderator','support']::public.user_role[]));

-- ── 6. Admin-Hilfsfunktionen ─────────────────────────────────────────────────

-- Kurzform: ist der aktuelle User ein Admin oder höher?
create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select public.has_any_role(array['admin','superadmin']::public.user_role[]);
$$;

-- Anzahl offene Bounties (für Admin-Dashboard)
create or replace function public.admin_stats()
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Kein Zugriff' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'bounties_open',      (select count(*) from public.bounties where status = 'open'),
    'bounties_draft',     (select count(*) from public.bounties where status = 'draft'),
    'bounties_expired',   (select count(*) from public.bounties where status = 'expired'),
    'referrals_submitted',(select count(*) from public.bounty_referrals where status = 'submitted'),
    'referrals_hired',    (select count(*) from public.bounty_referrals where status = 'hired'),
    'payouts_pending',    (select count(*) from public.payouts where status = 'pending'),
    'users_unverified',   (select count(*) from public.profiles where kyc_status = 'unverified'),
    'users_approved',     (select count(*) from public.profiles where kyc_status = 'approved')
  ) into v;

  return v;
end;
$$;

revoke execute on function public.admin_stats() from anon;
grant  execute on function public.admin_stats() to authenticated;
