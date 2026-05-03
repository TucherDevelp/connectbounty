-- Migration 0017: Rename referral_disputes -> bounty_disputes
--
-- Reason: The previous name "referral_disputes" was ambiguous and could be
-- misread as disputes *about* or *by* the Referrer role. The table records
-- disputes tied to a Bounty case (bounty_referrals), so "bounty_disputes"
-- is the accurate and unambiguous name.

-- 1. Rename the table
alter table if exists public.referral_disputes
  rename to bounty_disputes;

-- 2. Rename the unique constraint
alter table public.bounty_disputes
  rename constraint referral_disputes_one_per_referral
  to bounty_disputes_one_per_referral;

-- 3. Rename the index (indexes must be renamed via ALTER INDEX)
alter index if exists public.referral_disputes_status_idx
  rename to bounty_disputes_status_idx;

-- 4. Rename the RLS policy
alter policy referral_disputes_select_involved
  on public.bounty_disputes
  rename to bounty_disputes_select_involved;

-- 5. Rename the foreign key constraint
alter table public.bounty_disputes
  rename constraint referral_disputes_referral_id_fkey
  to bounty_disputes_referral_id_fkey;
