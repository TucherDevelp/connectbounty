-- ============================================================================
-- ConnectBounty - Schema v11: Anonyme Phase + Bewerbungs-Flag
-- ============================================================================
-- Konzeptbezug: docs/KONZEPTPLATTFORM-GESCHAEFTSMODELL.md, Abschnitt 4
-- (Tracking-Stationen 2-4: Kandidaten-Zuordnung anonym → Bewerbungs-Flag →
-- Kontaktfreigabe → aktiver Prozess).
--
-- Neu in dieser Migration:
--   • Erweiterung bounty_referrals     - application_submitted_at,
--                                        application_submitted_by,
--                                        contact_released_at,
--                                        contact_released_by
--   • Constraint                       - contact darf nur nach Bewerbungs-Flag
--                                        freigegeben werden (Kausalität).
--   • Neue Enum-Werte (audit_action)   - referral.application_flagged,
--                                        referral.contact_released
--   • View                             - bounty_referrals_owner_view, das
--                                        Kontaktdaten des Kandidaten erst
--                                        herausgibt, wenn application_submitted_at
--                                        gesetzt ist (Owner-Sicht).
--
-- Designprinzipien:
--   1. Sichtbarkeit der Kontaktdaten regeln wir auf View-/Application-Ebene -
--      RLS arbeitet zeilenbasiert; Spaltenmaskierung übernimmt der View.
--   2. Beide Spalten sind nullable - Bestandsdatensätze bleiben unberührt.
--   3. Trigger sorgt dafür, dass contact_released_at niemals VOR
--      application_submitted_at gesetzt werden kann.
--   4. Audit-Trail über logAuditEvent() in der Application-Schicht.
-- ============================================================================

-- ── 1. Audit-Action-Erweiterungen ──────────────────────────────────────────

alter type public.audit_action add value if not exists 'referral.application_flagged';
alter type public.audit_action add value if not exists 'referral.contact_released';

-- ── 2. bounty_referrals: neue Spalten ──────────────────────────────────────

alter table public.bounty_referrals
  add column if not exists application_submitted_at  timestamptz,
  add column if not exists application_submitted_by  uuid references public.profiles(id),
  add column if not exists contact_released_at       timestamptz,
  add column if not exists contact_released_by       uuid references public.profiles(id);

-- Kausalität: Kontakt erst freigeben, wenn Bewerbung geflaggt ist.
alter table public.bounty_referrals
  drop constraint if exists referrals_contact_after_application,
  add  constraint referrals_contact_after_application
    check (
      contact_released_at is null
      or (
        application_submitted_at is not null
        and contact_released_at >= application_submitted_at
      )
    );

create index if not exists bounty_referrals_application_flag_idx
  on public.bounty_referrals (application_submitted_at)
  where application_submitted_at is not null;

create index if not exists bounty_referrals_contact_released_idx
  on public.bounty_referrals (contact_released_at)
  where contact_released_at is not null;

-- ── 3. View: bounty_referrals_owner_view ───────────────────────────────────
-- Zeigt dem Bounty-Owner (Inserent) die Referrals seiner Bounties.
-- Kontakt-Felder werden NULLed, solange application_submitted_at IS NULL.
-- Diese View ist die kanonische Lesequelle für die Inserenten-UI.

create or replace view public.bounty_referrals_owner_view as
select
  r.id,
  r.bounty_id,
  r.referrer_id,
  r.candidate_user_id,
  r.status,
  r.created_at,
  r.status_changed_at,
  r.application_submitted_at,
  r.contact_released_at,
  -- Kontaktdaten erst nach Bewerbungs-Flag sichtbar:
  case when r.application_submitted_at is not null then r.candidate_name
       else null end as candidate_name,
  case when r.application_submitted_at is not null then r.candidate_email
       else null end as candidate_email,
  -- Bewerbungs-Phase (UI-Hinweis): 'anonymous' | 'application_submitted' | 'contact_released'
  case
    when r.contact_released_at is not null      then 'contact_released'
    when r.application_submitted_at is not null then 'application_submitted'
    else 'anonymous'
  end as application_phase
from public.bounty_referrals r;

-- View erbt RLS der zugrundeliegenden Tabelle (security_invoker default).
-- Wir machen es explizit, damit künftige Postgres-Defaults stabil bleiben.
alter view public.bounty_referrals_owner_view set (security_invoker = true);

grant select on public.bounty_referrals_owner_view to authenticated;
