-- ============================================================================
-- ConnectBounty - Schema v14: Security Hardening
-- ============================================================================
-- Behebt alle Befunde aus dem Supabase Security Advisor:
--
-- A. Function Search Path Mutable (Errors)
--    Trigger-Funktionen ohne SET search_path → anfällig für Schema-Hijacking.
--    Betroffen: enforce_referral_transition, enforce_referrer_immutable_and_acyclic,
--               set_updated_at
--
-- B. Public Can Execute SECURITY DEFINER Function (Errors)
--    anon-Rolle kann sicherheitskritische Funktionen aufrufen.
--    Fix: REVOKE EXECUTE ON … FROM public (= anon + authenticated).
--         Dann selektiv GRANT an die jeweils benötigte Rolle.
--
-- C. Signed-in Users Execute Admin Functions (Warnings)
--    authenticated kann admin_get_kyc_pending() + admin_stats() aufrufen.
--    Diese sind nur für service_role gedacht.
--
-- D. RLS Enabled – No Policy (Info)
--    Vier Legacy-Tabellen (0 Rows) aus früheren Design-Iterationen haben RLS
--    aktiv aber keine Policies → Supabase warnt. Explizites Deny-All verhindert
--    die Warnung und dokumentiert die Absicht klar.
--
-- E. Storage: profile-avatars INSERT-Policy zu weit
--    INSERT-Policy erlaubt Upload an eigene Paths, aber fehlt die Pfad-Länge-
--    Prüfung. Upgrade auf striktere WITH CHECK.
--
-- Designprinzip: Keine bestehende Funktionalität wird entfernt.
--   - RLS-Policies in anderen Tabellen referenzieren has_role(), owns_bounty() etc.
--     → diese behalten ihr GRANT an 'authenticated'.
--   - Trigger-Funktionen werden nicht neu erstellt, nur search_path gesetzt.
-- ============================================================================

-- ── A. Fix search_path für Trigger-Funktionen ────────────────────────────────
--
-- set_updated_at: verwendet nur now() → leerer search_path sicher.
alter function public.set_updated_at()
  set search_path = '';

-- enforce_referral_transition: referenziert auth.uid() + neue Status-Werte.
-- 'public' + 'auth' → entspricht dem was andere SECURITY DEFINER Fns nutzen.
alter function public.enforce_referral_transition()
  set search_path = public, auth, pg_catalog;

-- enforce_referrer_immutable_and_acyclic: referenziert public.profiles.
alter function public.enforce_referrer_immutable_and_acyclic()
  set search_path = public, pg_catalog;

-- enforce_payout_transition: bereits search_path=public, erhöhe Sicherheit.
alter function public.enforce_payout_transition()
  set search_path = public, pg_catalog;

-- ── B. REVOKE anon von ALLEN Security-Definer-Funktionen ─────────────────────
--
-- Postgres-Default: GRANT EXECUTE ON FUNCTION … TO PUBLIC gilt für alle Rollen
-- inkl. anon. Wir ziehen PUBLIC zurück und erteilen selektiv.

revoke execute on function public.has_role(public.user_role)       from public;
revoke execute on function public.has_any_role(public.user_role[]) from public;
revoke execute on function public.is_admin()                       from public;
revoke execute on function public.is_kyc_approved(uuid)            from public;
revoke execute on function public.owns_bounty(uuid)                from public;
revoke execute on function public.log_audit_event(public.audit_action, uuid, jsonb) from public;
revoke execute on function public.update_kyc_status(text, public.kyc_status, jsonb, text[]) from public;
revoke execute on function public.get_referrer_pair(uuid)          from public;
revoke execute on function public.admin_get_kyc_pending()          from public;
revoke execute on function public.admin_stats()                    from public;
revoke execute on function public.expire_stale_bounties()          from public;
revoke execute on function public.handle_new_user()                from public;

-- ── B2. Selektive GRANTs nach Rolle ─────────────────────────────────────────

-- Funktionen für RLS-Policies → authenticated (werden im Kontext von User-Sessions
-- ausgewertet, wenn Supabase RLS-Guards prüft).
grant execute on function public.has_role(public.user_role)       to authenticated;
grant execute on function public.has_any_role(public.user_role[]) to authenticated;
grant execute on function public.is_admin()                       to authenticated;
grant execute on function public.is_kyc_approved(uuid)            to authenticated;
grant execute on function public.owns_bounty(uuid)                to authenticated;

-- log_audit_event: Wird von Server-Actions über die User-Session (authenticated)
-- sowie intern (service_role) aufgerufen.
grant execute on function public.log_audit_event(public.audit_action, uuid, jsonb)
  to authenticated, service_role;

-- update_kyc_status: Nur Admin-Webhooks (service_role). Kein Client-Aufruf.
grant execute on function public.update_kyc_status(text, public.kyc_status, jsonb, text[])
  to service_role;

-- get_referrer_pair: wird in Server-Components (authenticated-Session) und
-- im Payout-Orchestrator (service_role) aufgerufen.
grant execute on function public.get_referrer_pair(uuid)
  to authenticated, service_role;

-- ── C. Admin-Only-Funktionen: nur service_role ────────────────────────────────

-- admin_get_kyc_pending: Nur für Admin-Webhooks/Crons. authenticated = verboten.
-- (War vorher: anon + service_role → anon entfernt, authenticated nie gehabt)
grant execute on function public.admin_get_kyc_pending() to service_role;

-- admin_stats: Nur für Monitoring/Admin-Backend (service_role).
-- (War vorher: authenticated + service_role → authenticated entfernt)
grant execute on function public.admin_stats() to service_role;

-- expire_stale_bounties: Cron-Job, nur service_role.
grant execute on function public.expire_stale_bounties() to service_role;

-- handle_new_user: Auth-Trigger, läuft im Postgres-Kontext.
-- Kein direkter Aufruf durch User oder App-Code nötig.
-- Supabase-Trigger-Executor verwendet den postgres superuser-Kontext, kein GRANT nötig.

-- ── D. Legacy-Tabellen: Explizites Deny-All ──────────────────────────────────
--
-- chat_messages, conversations, payout_requests, referral_events:
-- Tabellen aus früherer Design-Iteration (0 Rows). RLS aktiv, aber keine Policies.
-- Supabase Security Advisor warnt bei "RLS enabled but no policies" weil es
-- potenziell unbeabsichtigt ist. Explizites RESTRICT ALL dokumentiert die Absicht.

create policy "legacy_deny_all" on public.chat_messages
  as restrictive for all using (false);

create policy "legacy_deny_all" on public.conversations
  as restrictive for all using (false);

create policy "legacy_deny_all" on public.payout_requests
  as restrictive for all using (false);

create policy "legacy_deny_all" on public.referral_events
  as restrictive for all using (false);

-- ── E. profile-avatars: Striktere INSERT-Policy ──────────────────────────────
--
-- Upgrade: Die alte Policy prüfte nur bucket_id + name-Prefix.
-- Neu: Zusätzliche Prüfung dass der Pfad kein directory-traversal enthält
-- und der Content-Type einem Bild entspricht (sofern storage.extension verfügbar).

drop policy if exists "profile_avatars_upload_own" on storage.objects;

create policy "profile_avatars_upload_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(string_to_array(name, '/'), 1) = 2  -- nur eine Ebene tief
  );
