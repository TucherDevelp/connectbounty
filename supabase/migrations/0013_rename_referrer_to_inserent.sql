-- ============================================================================
-- ConnectBounty - Schema v13: Persona-Klarheit (Inserent ≠ Referrer)
-- ============================================================================
-- Problem:  Frühere Migrationen haben den Inserenten (Bounty-Ersteller) fälschlich
--           als "referrer" in der payouts-Tabelle benannt.
--           Das verursacht Code-Verwechslungen zwischen den drei Personas:
--             1. Inserent  — erstellt den Bounty (Arbeitgeber/Hiring-Firma)
--             2. Kandidat  — bewirbt sich auf den Job (Bewerber)
--             3. Referrer  — wirbt Nutzer für die Plattform an (reiner Akquise-Kanal)
--
-- Änderungen:
--   • payouts.referrer_id         → payouts.inserent_id
--   • payouts.amount_referrer_cents → payouts.amount_inserent_cents
--   • payouts.referrer_transfer_id → payouts.inserent_transfer_id
--   • bounties.split_referrer_bps  → bounties.split_inserent_bps
--
-- WICHTIG: profiles.referrer_id bleibt unverändert - dort bedeutet es korrekt
--          "durch wen wurde dieser User auf die Plattform referriert (= geworben)".
-- ============================================================================

-- ── 1. payouts: Spalten umbenennen ──────────────────────────────────────────

alter table public.payouts rename column referrer_id          to inserent_id;
alter table public.payouts rename column amount_referrer_cents to amount_inserent_cents;
alter table public.payouts rename column referrer_transfer_id  to inserent_transfer_id;

-- ── 2. bounties: Split-Spalte umbenennen ────────────────────────────────────

alter table public.bounties rename column split_referrer_bps to split_inserent_bps;

-- ── 3. Check-Constraint auf payouts neu erstellen ────────────────────────────
-- Alten Constraint entfernen (Name aus 0007), neuen mit korrektem Spalten-Bezug anlegen.

alter table public.payouts drop constraint if exists payouts_amounts_non_negative;

alter table public.payouts
  add constraint payouts_amounts_non_negative check (
    coalesce(amount_inserent_cents,  0) >= 0
    and coalesce(amount_candidate_cents, 0) >= 0
    and coalesce(amount_ref_of_a_cents,  0) >= 0
    and coalesce(amount_ref_of_b_cents,  0) >= 0
    and coalesce(amount_platform_fee_cents, 0) >= 0
  );
