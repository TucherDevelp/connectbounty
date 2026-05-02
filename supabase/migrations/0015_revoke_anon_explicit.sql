-- ============================================================================
-- ConnectBounty - Schema v15: Explizite REVOKE für anon-Rolle
-- ============================================================================
-- Hintergrund: Migration 0014 hat REVOKE FROM public ausgeführt, aber Supabase
-- verwaltet explizite Grants an die 'anon'-Rolle separat von 'public'.
-- Diese Migration entfernt die direkten anon-Grants auf Security-Definer-Fns.
--
-- Überprüft mit: select proname, acl_entry from fn_acl where acl_entry::text like 'anon=X/%'
-- ============================================================================

-- ── anon: Komplett-REVOKE auf alle Security-Definer-Funktionen ───────────────

revoke execute on function public.has_role(public.user_role)       from anon;
revoke execute on function public.has_any_role(public.user_role[]) from anon;
revoke execute on function public.is_admin()                       from anon;
revoke execute on function public.is_kyc_approved(uuid)            from anon;
revoke execute on function public.owns_bounty(uuid)                from anon;
revoke execute on function public.log_audit_event(public.audit_action, uuid, jsonb) from anon;
revoke execute on function public.update_kyc_status(text, public.kyc_status, jsonb, text[]) from anon;
revoke execute on function public.get_referrer_pair(uuid)          from anon;
revoke execute on function public.admin_get_kyc_pending()          from anon;
revoke execute on function public.admin_stats()                    from anon;
revoke execute on function public.handle_new_user()                from anon;

-- ── authenticated: Admin-Funktionen entziehen ────────────────────────────────
-- admin_stats und admin_get_kyc_pending sollen nur service_role aufrufen.

revoke execute on function public.admin_stats()            from authenticated;
revoke execute on function public.admin_get_kyc_pending()  from authenticated;
revoke execute on function public.handle_new_user()        from authenticated;
