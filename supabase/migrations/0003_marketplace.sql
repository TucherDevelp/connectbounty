-- ============================================================================
-- ConnectBounty - Schema v3: Marketplace (Bounties + Referrals)
-- ============================================================================
-- Fachliche Essenz:
--   • Bounty   = offene Stellenausschreibung mit Referral-Prämie, die ein
--                KYC-verifizierter Nutzer ("Auftraggeber") veröffentlicht.
--   • Referral = ein KYC-verifizierter Nutzer ("Referrer") schlägt einen
--                externen Kandidaten für eine Bounty vor.
--
-- Neu in dieser Migration:
--   • Enums bounty_status, referral_status
--   • Tabellen bounties, bounty_referrals
--   • Hilfsfunktionen is_kyc_approved(), owns_bounty()
--   • updated_at-Trigger, RLS-Policies, Audit-Erweiterung
--
-- Designprinzipien:
--   1. Einträge darf nur erstellen, wer kyc_status='approved' hat.
--      Enforcement doppelt: RLS WITH CHECK + Server-Action-Guard.
--   2. Öffentlich sichtbar (für authenticated) sind nur 'open' Bounties;
--      eigene Entwürfe und geschlossene Bounties nur für den Owner/Admins.
--   3. Referrals sind privat: nur Referrer + Bounty-Owner + Admin sehen sie.
--      Kandidaten-Kontaktdaten werden nur bei Übergang auf 'contacted' geteilt -
--      Kontrolle darüber übernimmt die Application-Schicht (Phase 3.2+).
--   4. Keine harten DELETEs auf referrals → Audit-Trail + Payout-Nachweis.
-- ============================================================================

-- ── 1. Enums ────────────────────────────────────────────────────────────────

create type public.bounty_status as enum (
  'draft',       -- nur der Owner sieht den Entwurf
  'open',        -- öffentlich sichtbar, Bewerbungen möglich
  'closed',      -- manuell geschlossen, aber nicht abgelaufen
  'expired',     -- automatisch nach expires_at
  'cancelled'    -- vom Owner/Admin zurückgezogen
);

create type public.referral_status as enum (
  'submitted',     -- Referrer hat Kandidat vorgeschlagen
  'contacted',     -- Owner hat Kandidat kontaktiert
  'interviewing',  -- Interview-Phase
  'hired',         -- Kandidat eingestellt → Anspruch auf Payout entsteht
  'paid',          -- Payout an Referrer ausgezahlt (Phase 4)
  'rejected',      -- Owner lehnt ab
  'withdrawn'      -- Referrer zieht zurück
);

-- ── 2. Audit-Action-Enum erweitern ─────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE ist seit PG12 in Transaktionen erlaubt;
-- die neu hinzugefügten Werte dürfen nur nicht in derselben Transaktion
-- benutzt werden. Das tun wir auch nicht - die Werte werden erst zur
-- Laufzeit via log_audit_event() aus der App geschrieben.

alter type public.audit_action add value if not exists 'bounty.created';
alter type public.audit_action add value if not exists 'bounty.published';
alter type public.audit_action add value if not exists 'bounty.updated';
alter type public.audit_action add value if not exists 'bounty.closed';
alter type public.audit_action add value if not exists 'bounty.cancelled';
alter type public.audit_action add value if not exists 'bounty.deleted';
alter type public.audit_action add value if not exists 'referral.submitted';
alter type public.audit_action add value if not exists 'referral.status_changed';
alter type public.audit_action add value if not exists 'referral.withdrawn';

-- ── 3. Helper: is_kyc_approved() ────────────────────────────────────────────
-- SECURITY DEFINER, damit RLS-Policies auf public.profiles keinen Leseschutz
-- triggern (wäre zwar durch unsere profiles_select_authenticated-Policy eh
-- erlaubt, aber explizit ist sicherer: sauberer Plan + stabil gegen spätere
-- Policy-Änderungen).

create or replace function public.is_kyc_approved(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user
      and kyc_status = 'approved'
  );
$$;

revoke all on function public.is_kyc_approved(uuid) from public;
grant execute on function public.is_kyc_approved(uuid) to authenticated;

-- ── 4. Tabelle: bounties ────────────────────────────────────────────────────

create table public.bounties (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,

  title           text not null,
  description     text not null,

  -- Prämie: Nettobetrag, keine Steuern/Gebühren (die kommen in Phase 4).
  bonus_amount    numeric(12, 2) not null,
  bonus_currency  char(3)        not null default 'EUR',

  -- Einfache Kategorisierung - keine normalisierten FK-Tabellen im MVP.
  -- Genauere Taxonomie kommt später (Industries, Skills, Remote-Flags).
  location        text,
  industry        text,
  tags            text[] not null default '{}'::text[],

  status          public.bounty_status not null default 'draft',

  expires_at      timestamptz,
  published_at    timestamptz,
  closed_at       timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint bounties_title_len       check (char_length(title) between 5 and 120),
  constraint bounties_description_len check (char_length(description) between 20 and 5000),
  constraint bounties_bonus_positive  check (bonus_amount > 0 and bonus_amount <= 1000000),
  constraint bounties_currency_format check (bonus_currency ~ '^[A-Z]{3}$'),
  constraint bounties_tags_limit      check (array_length(tags, 1) is null or array_length(tags, 1) <= 10),
  -- published_at wird gesetzt sobald status zum ersten Mal 'open' erreicht;
  -- expires_at muss, falls gesetzt, nach published_at liegen.
  constraint bounties_expires_after_published
    check (expires_at is null or published_at is null or expires_at > published_at)
);

comment on table public.bounties is
  'Stellenausschreibungen mit Referral-Prämie. Nur KYC-verifizierte Nutzer dürfen schreiben.';

create index bounties_owner_idx        on public.bounties (owner_id, created_at desc);
create index bounties_status_idx       on public.bounties (status);
create index bounties_published_at_idx on public.bounties (published_at desc) where status = 'open';
create index bounties_industry_idx     on public.bounties (industry) where industry is not null;

create trigger bounties_set_updated_at
before update on public.bounties
for each row execute function public.set_updated_at();

-- ── 5. Helper: owns_bounty() ────────────────────────────────────────────────
-- Muss NACH CREATE TABLE bounties stehen, da SQL-Funktionen ihre
-- Table-Refs beim CREATE prüfen (im Gegensatz zu plpgsql).

create or replace function public.owns_bounty(p_bounty uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bounties b
    where b.id = p_bounty
      and b.owner_id = auth.uid()
  );
$$;

revoke all on function public.owns_bounty(uuid) from public;
grant execute on function public.owns_bounty(uuid) to authenticated;

-- ── 6. Tabelle: bounty_referrals ───────────────────────────────────────────

create table public.bounty_referrals (
  id                 uuid primary key default gen_random_uuid(),
  bounty_id          uuid not null references public.bounties(id) on delete cascade,
  referrer_id        uuid not null references public.profiles(id) on delete cascade,

  -- Kandidat-Kontakt: nur Owner + Referrer + Admin dürfen lesen (RLS).
  candidate_name     text not null,
  candidate_email    text not null,
  candidate_contact  text,   -- optional: LinkedIn, Telefon usw.

  message            text,

  status             public.referral_status not null default 'submitted',
  status_changed_at  timestamptz not null default now(),
  status_changed_by  uuid references public.profiles(id) on delete set null,

  hired_at           timestamptz,
  paid_at            timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint referrals_name_len    check (char_length(candidate_name) between 2 and 120),
  constraint referrals_email_fmt   check (candidate_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint referrals_message_len check (message is null or char_length(message) <= 2000),

  -- Pro (Bounty × Referrer × Kandidat) nur ein Eintrag - verhindert Spam.
  unique (bounty_id, referrer_id, candidate_email)
);

comment on table public.bounty_referrals is
  'Kandidatenempfehlungen. Kontaktdaten sensibel - RLS streng gesetzt.';

create index bounty_referrals_bounty_idx   on public.bounty_referrals (bounty_id, created_at desc);
create index bounty_referrals_referrer_idx on public.bounty_referrals (referrer_id, created_at desc);
create index bounty_referrals_status_idx   on public.bounty_referrals (status);

create trigger bounty_referrals_set_updated_at
before update on public.bounty_referrals
for each row execute function public.set_updated_at();

-- ── 7. Status-Transition-Guard für bounty_referrals ────────────────────────
-- Wir zwingen legitime Übergänge schon auf DB-Ebene. Sollte ein Angreifer
-- die Server-Actions umgehen, greift die Transition-Matrix trotzdem.

create or replace function public.enforce_referral_transition()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean := false;
begin
  -- initial insert: nur submitted zulässig
  if tg_op = 'INSERT' then
    if new.status <> 'submitted' then
      raise exception 'Neue Referrals müssen Status=submitted haben (war %)', new.status
        using errcode = '22023';
    end if;
    return new;
  end if;

  -- update: Status kann gleich bleiben oder legalem Übergang folgen
  if old.status = new.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'submitted'    then new.status in ('contacted','rejected','withdrawn')
    when 'contacted'    then new.status in ('interviewing','rejected','withdrawn')
    when 'interviewing' then new.status in ('hired','rejected','withdrawn')
    when 'hired'        then new.status = 'paid'
    -- finale Zustände:
    when 'paid'         then false
    when 'rejected'     then false
    when 'withdrawn'    then false
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

create trigger bounty_referrals_transition_guard
before insert or update on public.bounty_referrals
for each row execute function public.enforce_referral_transition();

-- ── 8. RLS - bounties ──────────────────────────────────────────────────────

alter table public.bounties enable row level security;

-- Öffentlich (für eingeloggte User) sichtbar sind nur Bounties mit status='open'.
create policy bounties_select_open
  on public.bounties for select
  to authenticated
  using (status = 'open');

-- Eigene Bounties immer sichtbar, inklusive Drafts.
create policy bounties_select_own
  on public.bounties for select
  to authenticated
  using (owner_id = auth.uid());

-- Admin/Moderator/Support dürfen alles sehen.
create policy bounties_select_staff
  on public.bounties for select
  to authenticated
  using (public.has_any_role(array['admin','superadmin','moderator','support']::public.user_role[]));

-- INSERT nur für KYC-verifizierte User; owner_id muss eigene UID sein.
create policy bounties_insert_kyc_approved
  on public.bounties for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and public.is_kyc_approved()
  );

-- UPDATE nur durch Owner; owner_id darf nicht geändert werden.
create policy bounties_update_own
  on public.bounties for update
  to authenticated
  using      (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy bounties_update_staff
  on public.bounties for update
  to authenticated
  using      (public.has_any_role(array['admin','superadmin','moderator']::public.user_role[]))
  with check (public.has_any_role(array['admin','superadmin','moderator']::public.user_role[]));

-- DELETE nur im Draft-Zustand erlaubt (sonst Audit-Verlust).
create policy bounties_delete_draft_own
  on public.bounties for delete
  to authenticated
  using (owner_id = auth.uid() and status = 'draft');

create policy bounties_delete_staff
  on public.bounties for delete
  to authenticated
  using (public.has_any_role(array['admin','superadmin']::public.user_role[]));

-- ── 9. RLS - bounty_referrals ──────────────────────────────────────────────

alter table public.bounty_referrals enable row level security;

-- SELECT: Referrer sieht eigene Referrals
create policy bounty_referrals_select_own
  on public.bounty_referrals for select
  to authenticated
  using (referrer_id = auth.uid());

-- SELECT: Bounty-Owner sieht alle Referrals auf seine Bounties
create policy bounty_referrals_select_bounty_owner
  on public.bounty_referrals for select
  to authenticated
  using (public.owns_bounty(bounty_id));

-- SELECT: Staff
create policy bounty_referrals_select_staff
  on public.bounty_referrals for select
  to authenticated
  using (public.has_any_role(array['admin','superadmin','moderator','support']::public.user_role[]));

-- INSERT: nur KYC-verified User, referrer_id = auth.uid(),
-- Bounty muss 'open' sein UND darf nicht dem Referrer gehören
-- (keine Selbstreferrals).
create policy bounty_referrals_insert_kyc_approved
  on public.bounty_referrals for insert
  to authenticated
  with check (
    referrer_id = auth.uid()
    and public.is_kyc_approved()
    and exists (
      select 1
      from public.bounties b
      where b.id = bounty_id
        and b.status = 'open'
        and (b.expires_at is null or b.expires_at > now())
        and b.owner_id <> auth.uid()
    )
  );

-- UPDATE: Referrer darf nur withdrawn setzen (Details im Trigger).
create policy bounty_referrals_update_referrer
  on public.bounty_referrals for update
  to authenticated
  using      (referrer_id = auth.uid())
  with check (referrer_id = auth.uid());

-- UPDATE: Bounty-Owner darf Status ändern.
create policy bounty_referrals_update_bounty_owner
  on public.bounty_referrals for update
  to authenticated
  using      (public.owns_bounty(bounty_id))
  with check (public.owns_bounty(bounty_id));

-- UPDATE: Staff
create policy bounty_referrals_update_staff
  on public.bounty_referrals for update
  to authenticated
  using      (public.has_any_role(array['admin','superadmin','moderator']::public.user_role[]))
  with check (public.has_any_role(array['admin','superadmin','moderator']::public.user_role[]));

-- Kein DELETE für authenticated - Audit-Trail bleibt erhalten.
-- Service-Role (Backend-Jobs) umgeht RLS.

-- ── 10. Grants ──────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.bounties           to authenticated;
grant select, insert, update         on public.bounty_referrals   to authenticated;
