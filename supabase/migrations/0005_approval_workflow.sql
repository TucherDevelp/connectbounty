-- ============================================================================
-- ConnectBounty – Schema v5: Approval-Workflow
-- ============================================================================
-- Neu in dieser Migration:
--   • bounty_status bekommt 'pending_review'  (Warteliste nach Publish)
--   • referral_status bekommt 'pending_review' (Warteliste nach Submit)
--   • enforce_referral_transition wird erweitert
--   • Neue Audit-Actions: bounty.approved, bounty.rejected,
--                         referral.approved, referral.deleted
-- ============================================================================

-- ── 1. Enums erweitern ──────────────────────────────────────────────────────

alter type public.bounty_status add value if not exists 'pending_review' after 'draft';
alter type public.referral_status add value if not exists 'pending_review' before 'submitted';

-- ── 2. Audit-Actions ────────────────────────────────────────────────────────

alter type public.audit_action add value if not exists 'bounty.approved';
alter type public.audit_action add value if not exists 'bounty.rejected';
alter type public.audit_action add value if not exists 'referral.approved';
alter type public.audit_action add value if not exists 'referral.deleted';

-- ── 3. Transition-Guard für bounty_referrals aktualisieren ─────────────────
-- Jetzt gilt:
--   INSERT  → pending_review  (vorher: submitted)
--   pending_review → submitted  (Admin genehmigt)
--   pending_review → rejected   (Admin lehnt ab)
--   pending_review → withdrawn  (Referrer zieht zurück)
--   submitted → contacted | rejected | withdrawn
--   contacted → interviewing | rejected | withdrawn
--   interviewing → hired | rejected | withdrawn
--   hired → paid
--   paid / rejected / withdrawn → final (kein Übergang)

create or replace function public.enforce_referral_transition()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean := false;
begin
  -- INSERT: nur pending_review zulässig
  if tg_op = 'INSERT' then
    if new.status <> 'pending_review' then
      raise exception 'Neue Referrals müssen Status=pending_review haben (war %)', new.status
        using errcode = '22023';
    end if;
    return new;
  end if;

  -- UPDATE: gleicher Status ist ok
  if old.status = new.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'pending_review' then new.status in ('submitted', 'rejected', 'withdrawn')
    when 'submitted'      then new.status in ('contacted', 'rejected', 'withdrawn')
    when 'contacted'      then new.status in ('interviewing', 'rejected', 'withdrawn')
    when 'interviewing'   then new.status in ('hired', 'rejected', 'withdrawn')
    when 'hired'          then new.status = 'paid'
    -- finale Zustände:
    when 'paid'           then false
    when 'rejected'       then false
    when 'withdrawn'      then false
    else false
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
