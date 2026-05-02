-- ============================================================================
-- ConnectBounty - Schema v12: Ablehnungsschreiben (Rejection Documents)
-- ============================================================================
-- Konzeptbezug: docs/KONZEPTPLATTFORM-GESCHAEFTSMODELL.md, Abschnitt 4,
-- Tracking-Schritt 4 ("Aktiver Prozess und Ablehnungspflicht").
--
-- Nach der Kontaktfreigabe (Bewerbungs-Flag gesetzt) muss der Inserent ein
-- offizielles Ablehnungsschreiben hochladen, falls er den Prozess beenden
-- oder ablehnen will. Eine informelle / mündliche Ablehnung ist plattform-
-- seitig nicht ausreichend - ohne Dokument verbleibt der Vorgang aktiv.
--
-- Neu in dieser Migration:
--   • Tabelle rejection_documents          - vorgangsbezogen, append-only
--   • Storage-Bucket                       - 'rejection-documents' (privat)
--   • RLS                                  - Inserent + Kandidat sehen das
--                                            Dokument zu ihrem Vorgang;
--                                            Insert nur via service_role.
--   • Audit-Action-Erweiterung             - referral.rejection_uploaded
--
-- Designprinzipien:
--   1. Eigene Tabelle (nicht erweitern von hire_proof_documents) - klare
--      Trennung der Dokumenttypen, vereinfacht RLS und Lifecycle.
--   2. Verknüpfung an referral - wer wann was hochgeladen hat.
--   3. Storage-Pfad-Konvention: rejection-documents/{referral_id}/{uuid}.{ext}
--      Auf Buckets-Policy-Ebene durchgesetzt (siehe Section 4).
--   4. Kein DELETE - Audit-Trail muss erhalten bleiben.
-- ============================================================================

-- ── 1. Audit-Action-Erweiterung ───────────────────────────────────────────

alter type public.audit_action add value if not exists 'referral.rejection_uploaded';

-- ── 2. rejection_documents ────────────────────────────────────────────────

create table if not exists public.rejection_documents (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid not null references public.bounty_referrals(id) on delete cascade,
  uploaded_by   uuid not null references public.profiles(id)        on delete cascade,
  storage_path  text not null,
  original_name text,
  mime_type     text,
  file_size     int,
  created_at    timestamptz not null default now(),
  constraint rejection_docs_mime_check check (
    mime_type is null or mime_type in
      ('application/pdf','image/jpeg','image/png','image/webp')
  ),
  constraint rejection_docs_size_check check (
    file_size is null or file_size <= 10485760  -- 10 MB
  )
);

create index if not exists rejection_docs_referral_idx on public.rejection_documents (referral_id);
create index if not exists rejection_docs_uploader_idx on public.rejection_documents (uploaded_by);

alter table public.rejection_documents enable row level security;

-- Beteiligte des Vorgangs lesen (Inserent + Kandidat + Referrer + Staff).
create policy rejection_docs_select_involved
  on public.rejection_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.bounty_referrals r
      where r.id = rejection_documents.referral_id
        and (
          r.referrer_id = auth.uid()
          or r.candidate_user_id = auth.uid()
          or public.owns_bounty(r.bounty_id)
        )
    )
    or public.has_any_role(array['admin','superadmin','moderator','support']::public.user_role[])
  );

-- INSERT/UPDATE/DELETE ausschließlich über service_role (Server-Action).
grant select on public.rejection_documents to authenticated;

-- ── 3. Storage-Bucket ─────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('rejection-documents', 'rejection-documents', false)
on conflict (id) do nothing;

-- Storage-RLS: nur authentifizierte Beteiligte dürfen Objekte zu IHRER
-- referral_id lesen. Schreiben über signed-upload (service_role).
-- Pfad-Konvention: {referral_id}/{filename}

drop policy if exists "rejection_docs_storage_read" on storage.objects;
create policy "rejection_docs_storage_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'rejection-documents'
    and exists (
      select 1
      from public.bounty_referrals r
      where r.id::text = split_part(storage.objects.name, '/', 1)
        and (
          r.referrer_id = auth.uid()
          or r.candidate_user_id = auth.uid()
          or public.owns_bounty(r.bounty_id)
          or public.has_any_role(array['admin','superadmin','moderator','support']::public.user_role[])
        )
    )
  );

-- ── 4. Helper-View: zeigt das jüngste Ablehnungsschreiben pro Referral ────

create or replace view public.rejection_documents_latest as
select distinct on (referral_id)
  id,
  referral_id,
  uploaded_by,
  storage_path,
  original_name,
  mime_type,
  file_size,
  created_at
from public.rejection_documents
order by referral_id, created_at desc;

alter view public.rejection_documents_latest set (security_invoker = true);

grant select on public.rejection_documents_latest to authenticated;
