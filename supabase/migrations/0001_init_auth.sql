-- ============================================================================
-- ConnectBounty - Schema v1: Auth, Identity, Roles, Audit
-- ============================================================================
-- Diese Migration legt das Identitäts-Fundament:
--   • profiles      - pro auth.users genau eine Profilzeile
--   • user_roles    - mehrwertige RBAC-Rollen pro User
--   • audit_logs    - append-only Aktions-Log
--   • Enums         - user_role, kyc_status, audit_action
--   • has_role()    - SECURITY DEFINER, RLS-sicher
--   • Trigger       - Auto-Profile + 'registered_user' bei Signup, updated_at
--
-- Designprinzipien:
--   1. RLS ist auf ALLEN public-Tabellen aktiv. Niemals deaktivieren.
--   2. Schreibzugriff auf audit_logs nur via SECURITY DEFINER-Funktionen.
--   3. Rollenwechsel sind selbst auditierbar (eigene audit_action).
--   4. Service-Role-Client (Backend) umgeht RLS - bleibt aber an die
--      gleichen Tabellenstrukturen gebunden.
-- ============================================================================

-- ── 1. Enums ────────────────────────────────────────────────────────────────

create type public.user_role as enum (
  'guest',
  'registered_user',
  'verified_user',
  'moderator',
  'kyc_reviewer',
  'support',
  'admin',
  'superadmin'
);

create type public.kyc_status as enum (
  'unverified',
  'pending',
  'approved',
  'rejected',
  'expired'
);

create type public.audit_action as enum (
  'user.signup',
  'user.login',
  'user.logout',
  'user.profile_update',
  'user.email_change',
  'user.password_change',
  'user.role_grant',
  'user.role_revoke',
  'kyc.submitted',
  'kyc.approved',
  'kyc.rejected',
  'kyc.expired',
  'listing.created',
  'listing.updated',
  'listing.deleted',
  'listing.moderated',
  'chat.reported',
  'chat.message_blocked',
  'payout.requested',
  'payout.released',
  'payout.failed',
  'admin.action'
);

-- ── 2. profiles ─────────────────────────────────────────────────────────────

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  avatar_url        text,
  bio               text,
  locale            text not null default 'de',
  kyc_status        public.kyc_status not null default 'unverified',
  email_verified_at timestamptz,
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_display_name_len check (display_name is null or char_length(display_name) between 2 and 64),
  constraint profiles_bio_len          check (bio is null or char_length(bio) <= 500)
);

comment on table public.profiles is
  'Eine Zeile pro auth.users. Wird via Trigger handle_new_user() automatisch angelegt.';

-- ── 3. user_roles ───────────────────────────────────────────────────────────

create table public.user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.user_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

comment on table public.user_roles is
  'Mehrwertige RBAC: ein User kann mehrere Rollen haben (z. B. admin + kyc_reviewer).';

-- ── 4. audit_logs ───────────────────────────────────────────────────────────

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  target_id   uuid,
  action      public.audit_action not null,
  metadata    jsonb not null default '{}'::jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index audit_logs_actor_idx     on public.audit_logs (actor_id, created_at desc);
create index audit_logs_action_idx    on public.audit_logs (action, created_at desc);
create index audit_logs_target_idx    on public.audit_logs (target_id, created_at desc) where target_id is not null;

comment on table public.audit_logs is
  'Append-only. Schreibzugriff nur über SECURITY DEFINER-Funktionen oder Service-Role-Client.';

-- ── 5. has_role() / has_any_role() - RLS-sicher ────────────────────────────
-- SECURITY DEFINER, damit RLS-Policies sie aufrufen können, ohne dass der
-- Aufruf selbst eine RLS-Prüfung auf user_roles auslöst (sonst Endlos-Rekursion).
-- search_path = public ist Pflicht für SECURITY DEFINER-Funktionen.

create or replace function public.has_role(check_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role    = check_role
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

create or replace function public.has_any_role(check_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role    = any(check_roles)
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

revoke all on function public.has_role(public.user_role)            from public;
revoke all on function public.has_any_role(public.user_role[])      from public;
grant  execute on function public.has_role(public.user_role)        to authenticated;
grant  execute on function public.has_any_role(public.user_role[])  to authenticated;

-- ── 6. updated_at-Trigger (generisch) ──────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ── 7. Auto-Profile bei Signup ─────────────────────────────────────────────
-- Wird auf auth.users gefeuert (cross-schema). SECURITY DEFINER, weil
-- normale User auf public.user_roles keine INSERT-Rechte haben.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Neuer Nutzer'
    )
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'registered_user');

  insert into public.audit_logs (actor_id, action, metadata)
  values (
    new.id,
    'user.signup',
    jsonb_build_object(
      'email',    new.email,
      'provider', coalesce(new.raw_app_meta_data->>'provider', 'email')
    )
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ── 8. RLS - profiles ──────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Lesezugriff: jeder eingeloggte User darf jedes Profil lesen
-- (öffentliche Felder; sensible Daten kommen in eine separate Tabelle in Phase 2).
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

-- Self-Update: User darf nur die eigene Zeile ändern
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using      (id = auth.uid())
  with check (id = auth.uid());

-- Admin-Update
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using      (public.has_any_role(array['admin','superadmin']::public.user_role[]))
  with check (public.has_any_role(array['admin','superadmin']::public.user_role[]));

-- INSERT bewusst nicht erlaubt - nur via Trigger handle_new_user().
-- DELETE bewusst nicht erlaubt - Account-Löschung kaskadiert über auth.users.

-- ── 9. RLS - user_roles ────────────────────────────────────────────────────

alter table public.user_roles enable row level security;

create policy user_roles_select_own
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

create policy user_roles_select_admin
  on public.user_roles for select
  to authenticated
  using (public.has_any_role(array['admin','superadmin']::public.user_role[]));

-- Nur superadmin darf Rollen vergeben/entfernen
create policy user_roles_insert_superadmin
  on public.user_roles for insert
  to authenticated
  with check (public.has_role('superadmin'));

create policy user_roles_delete_superadmin
  on public.user_roles for delete
  to authenticated
  using (public.has_role('superadmin'));

-- ── 10. RLS - audit_logs ───────────────────────────────────────────────────

alter table public.audit_logs enable row level security;

create policy audit_logs_select_own
  on public.audit_logs for select
  to authenticated
  using (actor_id = auth.uid());

create policy audit_logs_select_admin
  on public.audit_logs for select
  to authenticated
  using (public.has_any_role(array['admin','superadmin','support']::public.user_role[]));

-- Kein INSERT/UPDATE/DELETE für authenticated - Schreibzugriff nur über
-- log_audit_event() (siehe unten) bzw. Service-Role.

-- ── 11. log_audit_event() - sichere Audit-Schreib-API ──────────────────────
-- Erlaubt User Code, Audit-Events zu erzeugen, ohne der Tabelle direkten
-- INSERT-Zugriff zu geben. SECURITY DEFINER + actor_id = auth.uid()
-- verhindert Spoofing.

create or replace function public.log_audit_event(
  p_action   public.audit_action,
  p_target   uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'log_audit_event: keine aktive Session';
  end if;

  insert into public.audit_logs (actor_id, target_id, action, metadata)
  values (auth.uid(), p_target, p_action, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_audit_event(public.audit_action, uuid, jsonb) from public;
grant execute on function public.log_audit_event(public.audit_action, uuid, jsonb) to authenticated;

-- ── 12. Tabellen-Grants (RLS gilt zusätzlich) ──────────────────────────────

grant usage  on schema public to anon, authenticated;
grant select on public.profiles    to authenticated;
grant update on public.profiles    to authenticated;
grant select on public.user_roles  to authenticated;
grant select on public.audit_logs  to authenticated;

-- Service-Role hat per Definition Vollzugriff (umgeht RLS).
