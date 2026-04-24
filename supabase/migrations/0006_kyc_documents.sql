-- ============================================================================
-- ConnectBounty - Schema v6: KYC Dokumente & Storage
-- ============================================================================
-- Neu:
--   • kyc_documents  - speichert Metadaten hochgeladener KYC-Dokumente
--   • Storage-Bucket "kyc-documents" (private, service_role only)
--   • get_kyc_applicant_with_docs() - Hilfsfunktion für Admin-Review
-- ============================================================================

-- ── 1. kyc_documents ────────────────────────────────────────────────────────

create table public.kyc_documents (
  id              uuid primary key default gen_random_uuid(),
  applicant_id    uuid not null references public.kyc_applicants(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  document_type   text not null,   -- 'id_card_front' | 'id_card_back' | 'passport' | 'selfie'
  storage_path    text not null,   -- Pfad im Supabase Storage Bucket "kyc-documents"
  file_size       integer,
  mime_type       text,
  created_at      timestamptz not null default now(),
  constraint kyc_documents_type_check check (
    document_type in ('id_card_front','id_card_back','passport','selfie')
  )
);

create index kyc_documents_applicant_id_idx on public.kyc_documents(applicant_id);
create index kyc_documents_user_id_idx      on public.kyc_documents(user_id);

-- Unique: pro Antrag darf jeder Dokument-Typ nur einmal vorkommen (für upsert)
create unique index kyc_documents_applicant_doctype_uidx
  on public.kyc_documents(applicant_id, document_type);

-- updated_at wird hier nicht benötigt; Dokumente sind immutable nach Upload.

-- ── 2. RLS ────────────────────────────────────────────────────────────────

alter table public.kyc_documents enable row level security;

-- User darf nur eigene Dokumente lesen (für Status-Anzeige)
create policy kyc_documents_select_own on public.kyc_documents
  for select to authenticated
  using (user_id = auth.uid());

-- User darf eigene Dokumente hochladen (insert via service_role nach Auth-Check)
-- Insert läuft über unsere API-Route (service_role), kein direkter Client-Insert

-- ── 3. Storage Bucket ────────────────────────────────────────────────────────
-- Der Bucket wird über die Supabase Management API oder UI angelegt.
-- Hier nur RLS-Policies für Storage-Objekte (falls Bucket bereits existiert).
--
-- WICHTIG: Bucket muss in der Supabase-Console angelegt werden:
--   Name: kyc-documents
--   Public: NEIN (private)
--   Max file size: 10 MB
--   Allowed MIME types: image/jpeg, image/png, image/webp
-- ============================================================================

-- ── 4. Hilfsfunktion für Admin: KYC-Antrag mit Dokumenten ──────────────────

create or replace function public.admin_get_kyc_pending()
returns table (
  applicant_row_id  uuid,
  user_id           uuid,
  applicant_id      text,
  level_name        text,
  kyc_status        public.kyc_status,
  review_result     jsonb,
  reject_labels     text[],
  reviewed_at       timestamptz,
  submitted_at      timestamptz,
  display_name      text,
  email             text,
  doc_count         bigint
)
language sql
security definer
set search_path = public
as $$
  select
    ka.id             as applicant_row_id,
    ka.user_id,
    ka.applicant_id,
    ka.level_name,
    ka.status         as kyc_status,
    ka.review_result,
    ka.reject_labels,
    ka.reviewed_at,
    ka.created_at     as submitted_at,
    p.display_name,
    au.email,
    count(kd.id)      as doc_count
  from public.kyc_applicants ka
  join public.profiles p on p.id = ka.user_id
  join auth.users au on au.id = ka.user_id
  left join public.kyc_documents kd on kd.applicant_id = ka.id
  where ka.status = 'pending'
  group by ka.id, p.id, au.id
  order by ka.created_at asc
$$;

revoke execute on function public.admin_get_kyc_pending from public, authenticated;
grant  execute on function public.admin_get_kyc_pending to service_role;

-- ── 5. update_kyc_status: Admin-seitige Erweiterung ─────────────────────────
-- Die bestehende Funktion (0002) wird hier nicht geändert - sie funktioniert
-- bereits korrekt für approve/reject über Webhook-Route.
-- Admin-Aktionen rufen dieselbe Funktion via service_role auf.
