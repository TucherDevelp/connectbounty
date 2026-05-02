-- ============================================================================
-- ConnectBounty - Schema v7: Three-Stage Confirmation + Split Payout
-- ============================================================================
-- Neu in dieser Migration:
--   • Erweiterung bounties          - Konzept-Split (40 % Inserent / 35 % Kandidat /
--                                     5 % Referrer / 20 % Plattform; 25 % Plattform
--                                     ohne Referrer; 2×2,5 % bei zwei Referrern),
--                                     gespeichert als Plattform-Basisblock 25 %.
--                                     Verbindliche Verankerung erfolgt im Code
--                                     (lib/stripe/split.ts → assertFixedSplit).
--   • Erweiterung profiles          - referrer_id + referral_code
--   • Erweiterung bounty_referrals  - drei Bestätigungs-Flags, Firmen-Billing,
--                                     rejection_reason (>= 50 Zeichen), Fenster,
--                                     neue Sub-Status
--   • Erweiterung payouts           - Split-Beträge, Invoice-ID, transfer_group,
--                                     Transfer-IDs je Empfänger
--   • Neue Tabellen                 - hire_proof_documents, referral_rejections,
--                                     referral_disputes, payment_reminders,
--                                     reputation_events
--   • Neue Enum-Werte               - referral_status & audit_action
--   • Trigger                        - enforce_referral_transition erweitert
--   • RLS                            - analog zu 0003/0006, strikt least-priv
--
-- Designprinzipien:
--   1. Enum-ALTERs in eigenem Statement; Tabellen-DDL folgt getrennt.
--   2. Alle neuen Spalten auf bounty_referrals sind nullable - Legacy-Flow
--      bleibt unberührt (Status 'submitted' → 'contacted' … existiert weiter).
--   3. Generated Column `all_confirmations_done` erzwingt Atomarität:
--      Payout-Orchestrator liest NUR dieses eine Flag.
--   4. rejection_reason wird als Soft-Constraint geprüft (≥ 50 Zeichen).
--   5. Referrer-Chains sind immutable nach dem ersten Set - Trigger verhindert
--      Änderung & Zyklen. Max Tiefe = 1 (wir zahlen nur den DIREKTEN Referrer).
--   6. payouts.referral_id bleibt UNIQUE - Trigger-Idempotenz.
-- ============================================================================

-- ── 1. Enum-Erweiterungen ───────────────────────────────────────────────────

alter type public.referral_status add value if not exists 'awaiting_hire_proof'         before 'submitted';
alter type public.referral_status add value if not exists 'awaiting_claim'              after  'awaiting_hire_proof';
alter type public.referral_status add value if not exists 'awaiting_payout_account'     after  'awaiting_claim';
alter type public.referral_status add value if not exists 'awaiting_data_forwarding'    after  'awaiting_payout_account';
alter type public.referral_status add value if not exists 'invoice_pending'             after  'awaiting_data_forwarding';
alter type public.referral_status add value if not exists 'invoice_paid'                after  'invoice_pending';
alter type public.referral_status add value if not exists 'disputed'                    after  'rejected';

alter type public.audit_action add value if not exists 'referral.hire_proof_uploaded';
alter type public.audit_action add value if not exists 'referral.claim_confirmed';
alter type public.audit_action add value if not exists 'referral.payout_account_confirmed';
alter type public.audit_action add value if not exists 'referral.data_forwarded';
alter type public.audit_action add value if not exists 'referral.confirmation_rejected';
alter type public.audit_action add value if not exists 'referral.dispute_opened';
alter type public.audit_action add value if not exists 'referral.dispute_resolved';
alter type public.audit_action add value if not exists 'payout.invoice_created';
alter type public.audit_action add value if not exists 'payout.invoice_paid';
alter type public.audit_action add value if not exists 'payout.transfers_dispatched';
alter type public.audit_action add value if not exists 'payout.completed';
alter type public.audit_action add value if not exists 'reminder.sent';

-- ── 2. profiles: Referrer-Chains ────────────────────────────────────────────

alter table public.profiles
  add column if not exists referrer_id   uuid references public.profiles(id),
  add column if not exists referral_code text unique;

-- Keine Self-Referral
alter table public.profiles
  drop constraint if exists profiles_no_self_referrer,
  add  constraint profiles_no_self_referrer
    check (referrer_id is null or referrer_id <> id);

-- Referrer ist immutable nach dem ersten Set (verhindert nachträgliche
-- Attribution-Manipulation). Zyklen schließen wir zusätzlich via Trigger aus.
create or replace function public.enforce_referrer_immutable_and_acyclic()
returns trigger
language plpgsql
as $$
declare
  v_cursor uuid;
  v_depth  int := 0;
begin
  -- immutable: einmal gesetzt, nicht mehr änderbar
  if tg_op = 'UPDATE'
     and old.referrer_id is not null
     and new.referrer_id is distinct from old.referrer_id
  then
    raise exception 'referrer_id ist nach dem ersten Set unveränderlich'
      using errcode = '22023';
  end if;

  if new.referrer_id is null then
    return new;
  end if;

  -- acyclic: verfolge die Kette maximal 16 Schritte
  v_cursor := new.referrer_id;
  while v_cursor is not null and v_depth < 16 loop
    if v_cursor = new.id then
      raise exception 'Zyklus in referrer-Kette erkannt'
        using errcode = '22023';
    end if;
    select p.referrer_id into v_cursor from public.profiles p where p.id = v_cursor;
    v_depth := v_depth + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_referrer on public.profiles;
create trigger profiles_enforce_referrer
  before insert or update of referrer_id on public.profiles
  for each row execute function public.enforce_referrer_immutable_and_acyclic();

-- ── 3. bounties: Split + Payment-Mode ───────────────────────────────────────
-- Hinweis: Diese Spalten halten den Konzept-Schlüssel als Plattform-Basisblock
-- (40 / 35 / 25). Der 5 %-Referrer-Anteil wird laufzeitseitig vom Plattform-
-- Block abgezogen, sobald ein Referrer beteiligt ist (computeFixedSplit).
-- Konzept-Schlüssel ist verbindlich; Abweichungen werden vom Orchestrator
-- via assertFixedSplit() blockiert.

alter table public.bounties
  add column if not exists split_referrer_bps   int  not null default 4000,
  add column if not exists split_candidate_bps  int  not null default 3500,
  add column if not exists split_platform_bps   int  not null default 2500,
  add column if not exists payment_mode         text not null default 'on_confirmation',
  add column if not exists escrow_payment_intent_id text;

alter table public.bounties
  drop constraint if exists bounties_split_sum_check,
  add  constraint bounties_split_sum_check
    check (split_referrer_bps + split_candidate_bps + split_platform_bps = 10000);

-- Plattform-Anteil muss mind. 5 % sein, damit 2×2,5% Referrer-Provision
-- immer darin Platz findet.
alter table public.bounties
  drop constraint if exists bounties_split_platform_min,
  add  constraint bounties_split_platform_min
    check (split_platform_bps >= 500);

alter table public.bounties
  drop constraint if exists bounties_payment_mode_check,
  add  constraint bounties_payment_mode_check
    check (payment_mode in ('on_confirmation','escrow'));

-- ── 4. bounty_referrals: Three-Stage Confirmation ──────────────────────────

alter table public.bounty_referrals
  add column if not exists candidate_user_id              uuid references public.profiles(id),
  add column if not exists hire_proof_uploaded_at         timestamptz,
  add column if not exists claim_confirmed_at             timestamptz,
  add column if not exists claim_confirmed_by             uuid references public.profiles(id),
  add column if not exists payout_account_confirmed_at    timestamptz,
  add column if not exists payout_account_confirmed_by    uuid references public.profiles(id),
  add column if not exists company_billing_id             text,
  add column if not exists company_name                   text,
  add column if not exists company_billing_email          text,
  add column if not exists company_billing_address        jsonb,
  add column if not exists company_tax_id                 text,
  add column if not exists data_forwarded_at              timestamptz,
  add column if not exists data_forwarded_by              uuid references public.profiles(id),
  add column if not exists payment_window_until           timestamptz,
  add column if not exists rejection_reason               text,
  add column if not exists rejection_stage                text,
  add column if not exists rejection_at                   timestamptz,
  add column if not exists rejection_by                   uuid references public.profiles(id);

alter table public.bounty_referrals
  drop constraint if exists referrals_rejection_reason_len,
  add  constraint referrals_rejection_reason_len
    check (rejection_reason is null or char_length(rejection_reason) >= 50);

alter table public.bounty_referrals
  drop constraint if exists referrals_rejection_stage_check,
  add  constraint referrals_rejection_stage_check
    check (rejection_stage is null or rejection_stage in
      ('hire_proof','claim','payout_account','data_forwarding'));

-- Generated column: Trigger für "alle drei Bestätigungen liegen vor".
-- PostgreSQL erlaubt STORED generated columns seit v12.
alter table public.bounty_referrals
  add column if not exists all_confirmations_done boolean
    generated always as (
      hire_proof_uploaded_at      is not null
      and claim_confirmed_at      is not null
      and payout_account_confirmed_at is not null
      and data_forwarded_at       is not null
    ) stored;

create index if not exists bounty_referrals_confirmations_idx
  on public.bounty_referrals (all_confirmations_done)
  where all_confirmations_done = true;

create index if not exists bounty_referrals_candidate_user_idx
  on public.bounty_referrals (candidate_user_id);

-- ── 5. bounty_referrals: Transition-Guard erweitert ────────────────────────

create or replace function public.enforce_referral_transition()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean := false;
begin
  -- INSERT: erlaubte Startzustände
  if tg_op = 'INSERT' then
    if new.status not in ('pending_review','awaiting_hire_proof') then
      raise exception 'Neue Referrals müssen Status=pending_review oder awaiting_hire_proof haben (war %)',
        new.status using errcode = '22023';
    end if;
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  v_allowed := case old.status
    -- Legacy-Flow
    when 'pending_review'           then new.status in ('submitted', 'rejected', 'withdrawn')
    when 'submitted'                then new.status in ('contacted', 'rejected', 'withdrawn')
    when 'contacted'                then new.status in ('interviewing', 'rejected', 'withdrawn')
    when 'interviewing'             then new.status in ('hired', 'rejected', 'withdrawn')
    when 'hired'                    then new.status in ('paid', 'disputed')
    -- Neuer 3-Stufen-Flow
    when 'awaiting_hire_proof'      then new.status in ('awaiting_claim','rejected','withdrawn')
    when 'awaiting_claim'           then new.status in ('awaiting_payout_account','rejected','withdrawn')
    when 'awaiting_payout_account'  then new.status in ('awaiting_data_forwarding','rejected','withdrawn')
    when 'awaiting_data_forwarding' then new.status in ('invoice_pending','rejected','withdrawn')
    when 'invoice_pending'          then new.status in ('invoice_paid','rejected','disputed')
    when 'invoice_paid'             then new.status in ('paid','disputed')
    -- Finale / terminale Zustände
    when 'paid'                     then false
    when 'rejected'                 then new.status in ('disputed')   -- B kann Dispute öffnen
    when 'withdrawn'                then false
    when 'disputed'                 then new.status in ('paid','rejected')
    else false
  end;

  if not v_allowed then
    raise exception 'Unzulässiger Referral-Statusübergang: % → %', old.status, new.status
      using errcode = '22023';
  end if;

  -- Audit-Felder automatisch setzen
  new.status_changed_at := now();
  new.status_changed_by := auth.uid();
  if new.status = 'hired' and new.hired_at is null then
    new.hired_at := now();
  end if;
  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;

  return new;
end;
$$;

-- ── 6. payouts: Split-Beträge + Invoice-Tracking ───────────────────────────

alter table public.payouts
  add column if not exists payment_intent_id         text,
  add column if not exists invoice_id                text,
  add column if not exists invoice_hosted_url        text,
  add column if not exists transfer_group            text,
  add column if not exists total_cents               int,
  add column if not exists amount_referrer_cents     int,
  add column if not exists amount_candidate_cents    int,
  add column if not exists amount_ref_of_a_cents     int,
  add column if not exists amount_ref_of_b_cents     int,
  add column if not exists amount_platform_fee_cents int,
  add column if not exists referrer_transfer_id      text,
  add column if not exists candidate_transfer_id     text,
  add column if not exists ref_of_a_transfer_id      text,
  add column if not exists ref_of_b_transfer_id      text,
  add column if not exists capture_method            text;

alter table public.payouts
  drop constraint if exists payouts_capture_method_check,
  add  constraint payouts_capture_method_check
    check (capture_method is null or capture_method in ('automatic','manual'));

alter table public.payouts
  drop constraint if exists payouts_split_nonnegative,
  add  constraint payouts_split_nonnegative check (
    coalesce(total_cents,0)               >= 0
    and coalesce(amount_referrer_cents,0) >= 0
    and coalesce(amount_candidate_cents,0) >= 0
    and coalesce(amount_ref_of_a_cents,0)  >= 0
    and coalesce(amount_ref_of_b_cents,0)  >= 0
    and coalesce(amount_platform_fee_cents,0) >= 0
  );

create index if not exists payouts_invoice_id_idx       on public.payouts (invoice_id);
create index if not exists payouts_transfer_group_idx   on public.payouts (transfer_group);

-- ── 7. hire_proof_documents ─────────────────────────────────────────────────

create table if not exists public.hire_proof_documents (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid not null references public.bounty_referrals(id) on delete cascade,
  user_id       uuid not null references public.profiles(id)        on delete cascade,
  storage_path  text not null,
  mime_type     text,
  file_size     int,
  created_at    timestamptz not null default now(),
  constraint hire_proof_docs_mime_check check (
    mime_type is null or mime_type in
      ('application/pdf','image/jpeg','image/png','image/webp')
  ),
  constraint hire_proof_docs_size_check check (file_size is null or file_size <= 10485760) -- 10 MB
);

create index if not exists hire_proof_docs_referral_idx on public.hire_proof_documents (referral_id);
create index if not exists hire_proof_docs_user_idx     on public.hire_proof_documents (user_id);

alter table public.hire_proof_documents enable row level security;

create policy hire_proof_docs_select_own
  on public.hire_proof_documents for select
  to authenticated
  using (user_id = auth.uid());

-- Bounty-Owner (A) darf Hire-Proofs zu seinen Referrals lesen
create policy hire_proof_docs_select_bounty_owner
  on public.hire_proof_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.bounty_referrals r
      where r.id = hire_proof_documents.referral_id
        and public.owns_bounty(r.bounty_id)
    )
  );

create policy hire_proof_docs_select_staff
  on public.hire_proof_documents for select
  to authenticated
  using (public.has_any_role(array['admin','superadmin','moderator','support']::public.user_role[]));

-- INSERT/UPDATE/DELETE nur über service_role (Server-Action).

grant select on public.hire_proof_documents to authenticated;

-- ── 8. referral_rejections (append-only Audit) ─────────────────────────────

create table if not exists public.referral_rejections (
  id           uuid primary key default gen_random_uuid(),
  referral_id  uuid not null references public.bounty_referrals(id) on delete cascade,
  stage        text not null check (stage in ('hire_proof','claim','payout_account','data_forwarding')),
  reason       text not null check (char_length(reason) >= 50),
  rejected_by  uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);

create index if not exists referral_rejections_referral_idx on public.referral_rejections (referral_id);

alter table public.referral_rejections enable row level security;

create policy referral_rejections_select_involved
  on public.referral_rejections for select
  to authenticated
  using (
    exists (
      select 1 from public.bounty_referrals r
      where r.id = referral_rejections.referral_id
        and (r.referrer_id = auth.uid()
             or r.candidate_user_id = auth.uid()
             or public.owns_bounty(r.bounty_id))
    )
    or public.has_any_role(array['admin','superadmin','moderator','support']::public.user_role[])
  );

-- Insert ausschließlich via service_role (Server-Action).
grant select on public.referral_rejections to authenticated;

-- ── 9. referral_disputes ───────────────────────────────────────────────────

create table if not exists public.referral_disputes (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid not null references public.bounty_referrals(id) on delete cascade,
  opened_by     uuid not null references public.profiles(id),
  reason        text not null check (char_length(reason) >= 50),
  status        text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolver_id   uuid references public.profiles(id),
  resolution    text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  constraint referral_disputes_one_per_referral unique (referral_id)
);

create index if not exists referral_disputes_status_idx on public.referral_disputes (status);

alter table public.referral_disputes enable row level security;

create policy referral_disputes_select_involved
  on public.referral_disputes for select
  to authenticated
  using (
    exists (
      select 1 from public.bounty_referrals r
      where r.id = referral_disputes.referral_id
        and (r.referrer_id = auth.uid()
             or r.candidate_user_id = auth.uid()
             or public.owns_bounty(r.bounty_id))
    )
    or public.has_any_role(array['admin','superadmin','moderator','support']::public.user_role[])
  );

grant select on public.referral_disputes to authenticated;

-- ── 10. payment_reminders ──────────────────────────────────────────────────

create table if not exists public.payment_reminders (
  id           uuid primary key default gen_random_uuid(),
  referral_id  uuid not null references public.bounty_referrals(id) on delete cascade,
  due_day      smallint not null check (due_day in (7,10,13)),
  channel      text not null check (channel in ('email','in_app')),
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  constraint payment_reminders_once unique (referral_id, due_day, channel)
);

create index if not exists payment_reminders_referral_idx on public.payment_reminders (referral_id);

alter table public.payment_reminders enable row level security;

create policy payment_reminders_select_involved
  on public.payment_reminders for select
  to authenticated
  using (
    exists (
      select 1 from public.bounty_referrals r
      where r.id = payment_reminders.referral_id
        and (r.referrer_id = auth.uid()
             or r.candidate_user_id = auth.uid()
             or public.owns_bounty(r.bounty_id))
    )
    or public.has_any_role(array['admin','superadmin','moderator','support']::public.user_role[])
  );

grant select on public.payment_reminders to authenticated;

-- ── 11. reputation_events ──────────────────────────────────────────────────

create table if not exists public.reputation_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  event_type    text not null check (event_type in
    ('paid_on_time','paid_late','failed','disputed_against','dispute_won')),
  amount_cents  int,
  reference_id  uuid,           -- referral_id oder dispute_id
  created_at    timestamptz not null default now()
);

create index if not exists reputation_events_user_idx on public.reputation_events (user_id, created_at desc);

alter table public.reputation_events enable row level security;

create policy reputation_events_select_public
  on public.reputation_events for select
  to authenticated
  using (true);  -- Reputation ist öffentlich sichtbar

grant select on public.reputation_events to authenticated;

-- ── 12. View: user_reputation_scores ───────────────────────────────────────

create or replace view public.user_reputation_scores as
select
  p.id                                                             as user_id,
  count(*) filter (where e.event_type = 'paid_on_time')             as paid_on_time,
  count(*) filter (where e.event_type = 'paid_late')                as paid_late,
  count(*) filter (where e.event_type = 'failed')                   as failed_count,
  count(*) filter (where e.event_type = 'disputed_against')         as disputed_against,
  count(*) filter (where e.event_type = 'dispute_won')              as dispute_won,
  coalesce(sum(e.amount_cents) filter (where e.event_type in
    ('paid_on_time','paid_late')), 0)                               as total_paid_cents
from public.profiles p
left join public.reputation_events e on e.user_id = p.id
group by p.id;

grant select on public.user_reputation_scores to authenticated;

-- ── 13. Hilfsfunktion: get_referrer_chain(referral_id) ─────────────────────
-- Liefert IDs (oder NULL) des direkten Referrers von Inserent (A) und Kandidat (B)
-- für ein gegebenes Referral. Wird vom Orchestrator vor der Split-Berechnung
-- aufgerufen.

create or replace function public.get_referrer_pair(p_referral uuid)
returns table (
  referrer_of_a uuid,
  referrer_of_b uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pa.referrer_id as referrer_of_a,
    pb.referrer_id as referrer_of_b
  from public.bounty_referrals r
  join public.bounties b              on b.id = r.bounty_id
  join public.profiles pa             on pa.id = b.owner_id           -- Inserent A
  left join public.profiles pb        on pb.id = r.candidate_user_id  -- Kandidat B (kann NULL sein)
  where r.id = p_referral;
$$;

revoke all on function public.get_referrer_pair(uuid) from public;
grant execute on function public.get_referrer_pair(uuid) to authenticated, service_role;
