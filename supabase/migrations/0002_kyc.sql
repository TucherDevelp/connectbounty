-- ============================================================================
-- ConnectBounty - Schema v2: KYC (Sumsub)
-- ============================================================================
-- Neu in dieser Migration:
--   • kyc_applicants   - speichert Sumsub applicantId + Statusverlauf
--   • update_kyc_status() - SECURITY DEFINER: schreibt kyc_status in profiles
--                           (wird vom Webhook via service_role gerufen)
--
-- Designprinzipien:
--   • kyc_applicants wird NIEMALS direkt vom Browser beschrieben.
--     Insert: authenticated user (eigener Eintrag), Update: service_role only.
--   • profiles.kyc_status ist die "Single Source of Truth" für die App-Logik.
--     kyc_applicants speichert die vollständige Sumsub-Historie.
-- ============================================================================

-- ── 1. kyc_applicants ──────────────────────────────────────────────────────

create table public.kyc_applicants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  applicant_id    text not null unique,           -- Sumsub applicantId
  level_name      text not null,                 -- Sumsub verification level
  status          public.kyc_status not null default 'pending',
  review_result   jsonb,                         -- rohes Sumsub reviewResult-Objekt
  reject_labels   text[],                        -- z.B. {"FORGERY","DOCUMENT_PAGE_MISSING"}
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Schneller Lookup: user_id → neuester KYC-Antrag
create index kyc_applicants_user_id_idx on public.kyc_applicants(user_id);

-- updated_at Trigger (nutzt generic Funktion aus 0001)
create trigger kyc_applicants_updated_at
  before update on public.kyc_applicants
  for each row execute function public.set_updated_at();

-- ── 2. RLS ────────────────────────────────────────────────────────────────

alter table public.kyc_applicants enable row level security;

-- User darf nur seinen eigenen Eintrag lesen
create policy kyc_applicants_select_own on public.kyc_applicants
  for select to authenticated
  using (user_id = auth.uid());

-- User darf eigenen Eintrag anlegen (einmalig - UNIQUE auf applicant_id verhindert Duplikate)
create policy kyc_applicants_insert_own on public.kyc_applicants
  for insert to authenticated
  with check (user_id = auth.uid());

-- Updates nur via service_role (Webhook-Handler), niemals durch den Client selbst
-- Kein UPDATE-Policy für authenticated → service_role umgeht RLS

-- ── 3. update_kyc_status() ────────────────────────────────────────────────

create or replace function public.update_kyc_status(
  p_applicant_id  text,
  p_status        public.kyc_status,
  p_review_result jsonb  default null,
  p_reject_labels text[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- Applicant-Eintrag updaten
  update public.kyc_applicants
  set
    status        = p_status,
    review_result = coalesce(p_review_result, review_result),
    reject_labels = coalesce(p_reject_labels, reject_labels),
    reviewed_at   = case when p_status in ('approved','rejected','expired')
                         then now() else reviewed_at end,
    updated_at    = now()
  where applicant_id = p_applicant_id
  returning user_id into v_user_id;

  if v_user_id is null then
    raise exception 'kyc_applicant not found: %', p_applicant_id;
  end if;

  -- profiles.kyc_status synchron halten
  update public.profiles
  set kyc_status = p_status,
      updated_at = now()
  where id = v_user_id;
end;
$$;

-- Nur service_role darf update_kyc_status() aufrufen
revoke execute on function public.update_kyc_status from public, authenticated;
grant execute on function public.update_kyc_status to service_role;

-- Migrationsprotokoll wird vom Runner (scripts/db-migrate.mjs) automatisch
-- in public._migrations geschrieben - kein manueller Insert nötig.
