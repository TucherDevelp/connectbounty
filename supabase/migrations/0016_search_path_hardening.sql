-- ============================================================================
-- ConnectBounty – Schema v16: search_path = '' für alle Funktionen
-- ============================================================================
-- Problem: Supabase Security Advisor meldet "Function Search Path Mutable"
--   für Funktionen mit SET search_path = 'public'.
-- Risiko in der Praxis: gering – aber Supabase-Standard für Production ist '',
--   weil damit Schema-Hijacking durch gleichnamige Objekte unmöglich ist.
--
-- Ansatz:
--   • search_path auf '' (leer) setzen.
--   • pg_catalog wird von Postgres IMMER durchsucht, unabhängig vom search_path
--     → now(), coalesce(), exists() usw. brauchen KEIN Präfix.
--   • auth.uid() ist bereits voll qualifiziert → kein Änderungsbedarf.
--   • public.tablename sind bereits voll qualifiziert → kein Änderungsbedarf.
--   • Einzig Enum-Typen in Funktions-Signaturen (Parameter/Rückgabe) brauchen
--     das explizite 'public.'-Präfix, weil sie sonst nicht aufgelöst werden.
--
-- Alle Funktionskörper bleiben inhaltlich identisch.
-- ============================================================================

-- ── has_role ────────────────────────────────────────────────────────────────
create or replace function public.has_role(check_role public.user_role)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role    = check_role
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

-- ── has_any_role ─────────────────────────────────────────────────────────────
create or replace function public.has_any_role(check_roles public.user_role[])
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role    = any(check_roles)
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

-- ── is_admin ─────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select public.has_any_role(array['admin','superadmin']::public.user_role[]);
$$;

-- ── is_kyc_approved ──────────────────────────────────────────────────────────
create or replace function public.is_kyc_approved(p_user uuid default auth.uid())
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user
      and kyc_status = 'approved'
  );
$$;

-- ── owns_bounty ───────────────────────────────────────────────────────────────
create or replace function public.owns_bounty(p_bounty uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.bounties b
    where b.id       = p_bounty
      and b.owner_id = auth.uid()
  );
$$;

-- ── log_audit_event ───────────────────────────────────────────────────────────
create or replace function public.log_audit_event(
  p_action   public.audit_action,
  p_target   uuid    default null,
  p_metadata jsonb   default '{}'
)
  returns bigint
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'log_audit_event: keine aktive Session';
  end if;

  insert into public.audit_logs (actor_id, target_id, action, metadata)
  values (auth.uid(), p_target, p_action, coalesce(p_metadata, '{}'))
  returning id into v_id;

  return v_id;
end;
$$;

-- ── get_referrer_pair ─────────────────────────────────────────────────────────
create or replace function public.get_referrer_pair(p_referral uuid)
  returns table(referrer_of_a uuid, referrer_of_b uuid)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    pa.referrer_id as referrer_of_a,
    pb.referrer_id as referrer_of_b
  from public.bounty_referrals r
  join public.bounties  b  on b.id  = r.bounty_id
  join public.profiles  pa on pa.id = b.owner_id
  left join public.profiles pb on pb.id = r.candidate_user_id
  where r.id = p_referral;
$$;

-- ── update_kyc_status ─────────────────────────────────────────────────────────
create or replace function public.update_kyc_status(
  p_applicant_id  text,
  p_status        public.kyc_status,
  p_review_result jsonb    default null,
  p_reject_labels text[]   default null
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_user_id uuid;
begin
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

  update public.profiles
  set kyc_status = p_status,
      updated_at = now()
  where id = v_user_id;
end;
$$;

-- ── admin_stats ────────────────────────────────────────────────────────────────
create or replace function public.admin_stats()
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Kein Zugriff' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'bounties_open',       (select count(*) from public.bounties where status = 'open'),
    'bounties_draft',      (select count(*) from public.bounties where status = 'draft'),
    'bounties_expired',    (select count(*) from public.bounties where status = 'expired'),
    'referrals_submitted', (select count(*) from public.bounty_referrals where status = 'submitted'),
    'referrals_hired',     (select count(*) from public.bounty_referrals where status = 'hired'),
    'payouts_pending',     (select count(*) from public.payouts where status = 'pending'),
    'users_unverified',    (select count(*) from public.profiles where kyc_status = 'unverified'),
    'users_approved',      (select count(*) from public.profiles where kyc_status = 'approved')
  ) into v;

  return v;
end;
$$;

-- ── admin_get_kyc_pending ─────────────────────────────────────────────────────
create or replace function public.admin_get_kyc_pending()
  returns table(
    applicant_row_id uuid,
    user_id          uuid,
    applicant_id     text,
    level_name       text,
    kyc_status       public.kyc_status,
    review_result    jsonb,
    reject_labels    text[],
    reviewed_at      timestamptz,
    submitted_at     timestamptz,
    display_name     text,
    email            text,
    doc_count        bigint
  )
  language sql
  security definer
  set search_path = ''
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
  join public.profiles   p  on p.id  = ka.user_id
  join auth.users        au on au.id = ka.user_id
  left join public.kyc_documents kd on kd.applicant_id = ka.id
  where ka.status = 'pending'
  group by ka.id, p.id, au.id
  order by ka.created_at asc;
$$;

-- ── expire_stale_bounties ─────────────────────────────────────────────────────
create or replace function public.expire_stale_bounties()
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_count int;
begin
  with expired as (
    update public.bounties
    set
      status     = 'expired'::public.bounty_status,
      closed_at  = now(),
      updated_at = now()
    where
      status     = 'open'
      and expires_at is not null
      and expires_at < now()
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

-- ── handle_new_user (Auth-Trigger) ───────────────────────────────────────────
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
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

-- ── enforce_payout_transition (Trigger) ───────────────────────────────────────
create or replace function public.enforce_payout_transition()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if old.status in ('paid', 'cancelled') then
    raise exception 'unzulässiger Payout-Übergang: % → %', old.status, new.status
      using errcode = '22023';
  end if;

  if not (
    (old.status = 'pending'    and new.status in ('processing','cancelled'))
    or (old.status = 'processing' and new.status in ('paid','failed','cancelled'))
    or (old.status = 'failed'     and new.status in ('pending','cancelled'))
  ) then
    raise exception 'unzulässiger Payout-Übergang: % → %', old.status, new.status
      using errcode = '22023';
  end if;

  if new.status = 'processing' then new.processing_started_at := now(); end if;
  if new.status = 'paid'       then new.paid_at               := now(); end if;
  if new.status = 'failed'     then new.failed_at             := now(); end if;
  if new.status = 'cancelled'  then new.cancelled_at          := now(); end if;

  return new;
end;
$$;

-- ── enforce_referral_transition (Trigger) ─────────────────────────────────────
create or replace function public.enforce_referral_transition()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_allowed boolean := false;
begin
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
    when 'pending_review'           then new.status in ('submitted','rejected','withdrawn')
    when 'submitted'                then new.status in ('contacted','rejected','withdrawn')
    when 'contacted'                then new.status in ('interviewing','rejected','withdrawn')
    when 'interviewing'             then new.status in ('hired','rejected','withdrawn')
    when 'hired'                    then new.status in ('paid','disputed')
    when 'awaiting_hire_proof'      then new.status in ('awaiting_claim','rejected','withdrawn')
    when 'awaiting_claim'           then new.status in ('awaiting_payout_account','rejected','withdrawn')
    when 'awaiting_payout_account'  then new.status in ('awaiting_data_forwarding','rejected','withdrawn')
    when 'awaiting_data_forwarding' then new.status in ('invoice_pending','rejected','withdrawn')
    when 'invoice_pending'          then new.status in ('invoice_paid','rejected','disputed')
    when 'invoice_paid'             then new.status in ('paid','disputed')
    when 'paid'                     then false
    when 'rejected'                 then new.status in ('disputed')
    when 'withdrawn'                then false
    when 'disputed'                 then new.status in ('paid','rejected')
    else false
  end;

  if not v_allowed then
    raise exception 'Unzulässiger Referral-Statusübergang: % → %', old.status, new.status
      using errcode = '22023';
  end if;

  new.status_changed_at := now();
  new.status_changed_by := auth.uid();
  if new.status = 'hired' and new.hired_at is null then new.hired_at := now(); end if;
  if new.status = 'paid'  and new.paid_at  is null then new.paid_at  := now(); end if;

  return new;
end;
$$;

-- ── enforce_referrer_immutable_and_acyclic (Trigger) ─────────────────────────
create or replace function public.enforce_referrer_immutable_and_acyclic()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_cursor uuid;
  v_depth  int := 0;
begin
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

-- ── GRANTs wiederherstellen (CREATE OR REPLACE resettet keine Grants) ─────────
-- Die GRANTs aus 0014/0015 bleiben erhalten – CREATE OR REPLACE löscht nur
-- den Funktionskörper, nicht die Berechtigungen. Zur Sicherheit dennoch
-- explizit gesetzt:
grant execute on function public.has_role(public.user_role)       to authenticated, service_role;
grant execute on function public.has_any_role(public.user_role[]) to authenticated, service_role;
grant execute on function public.is_admin()                       to authenticated, service_role;
grant execute on function public.is_kyc_approved(uuid)            to authenticated, service_role;
grant execute on function public.owns_bounty(uuid)                to authenticated, service_role;
grant execute on function public.log_audit_event(public.audit_action, uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.get_referrer_pair(uuid)          to authenticated, service_role;
grant execute on function public.update_kyc_status(text, public.kyc_status, jsonb, text[])
  to service_role;
grant execute on function public.admin_stats()            to service_role;
grant execute on function public.admin_get_kyc_pending()  to service_role;
grant execute on function public.expire_stale_bounties()  to service_role;
