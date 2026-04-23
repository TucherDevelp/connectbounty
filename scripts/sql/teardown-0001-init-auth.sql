-- Dev/Reset: Entfernt alles aus 0001_init_auth.sql (nur leere / Test-DBs).
-- Supabase SQL Editor oder: npm run db:teardown-auth
-- WARNUNG: Löscht public.profiles, user_roles, audit_logs und zugehörige Typen.

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user() cascade;

drop table if exists public.audit_logs cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;

drop function if exists public.has_role(public.user_role) cascade;
drop function if exists public.has_any_role(public.user_role[]) cascade;
drop function if exists public.log_audit_event(public.audit_action, uuid, jsonb) cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.audit_action cascade;
drop type if exists public.kyc_status cascade;
drop type if exists public.user_role cascade;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = '_migrations'
  ) then
    delete from public._migrations where filename = '0001_init_auth.sql';
  end if;
end $$;
