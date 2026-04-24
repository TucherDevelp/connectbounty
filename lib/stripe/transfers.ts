import "server-only";

import { getStripeClient } from "./client";
import type { SplitResult } from "./split";

export type TransferAccounts = {
  /** Stripe Connect Account-ID von Inserent A (acct_...) */
  personA: string;
  /** Stripe Connect Account-ID von Kandidat B (acct_...) */
  personB: string;
  /** Connect-Account von Referrer-A - null falls nicht vorhanden */
  refOfA: string | null;
  /** Connect-Account von Referrer-B - null falls nicht vorhanden */
  refOfB: string | null;
};

export type SplitTransferInput = {
  referralId: string;
  /** Format: `inv_<invoiceId>` - verbindet alle Transfers einer Transaktion */
  transferGroup: string;
  currency: string;
  split: SplitResult;
  accounts: TransferAccounts;
};

export type SplitTransferResult = {
  personATransferId: string;
  personBTransferId: string;
  refOfATransferId: string | null;
  refOfBTransferId: string | null;
};

/**
 * Führt bis zu 4 Stripe-Transfers nach einer bezahlten Invoice aus.
 *
 * Idempotenz-Strategie:
 *   Jeder Transfer erhält einen deterministischen Idempotency-Key
 *   `transfer_<referralId>_<rolle>`. Stripe garantiert, dass ein
 *   wiederholter Request mit gleichem Key denselben Transfer zurückgibt,
 *   statt einen zweiten zu erzeugen.
 *
 * Fehlerbehandlung:
 *   Schlägt ein Transfer fehl, wird die Ausnahme nach oben propagiert.
 *   Der Caller (Orchestrator / Webhook) ist verantwortlich für den
 *   Payout-Status-Update auf "failed". Bereits gebuchte Transfers werden
 *   NICHT automatisch revertiert (Stripe-Best-Practice: nur via Admin).
 *
 * Reihenfolge: A → B → Ref-A → Ref-B (Reihenfolge ist für Idempotenz
 *   irrelevant, aber konsistent halten für Monitoring).
 */
export async function createSplitTransfers(
  input: SplitTransferInput,
): Promise<SplitTransferResult> {
  const stripe = getStripeClient();
  const { referralId, transferGroup, currency, split, accounts } = input;
  const cur = currency.toLowerCase();

  // Transfer an Inserent A
  const transferA = await stripe.transfers.create(
    {
      amount: split.personACents,
      currency: cur,
      destination: accounts.personA,
      transfer_group: transferGroup,
      metadata: {
        connectbounty_referral_id: referralId,
        role: "person_a",
      },
    },
    { idempotencyKey: `transfer_${referralId}_person_a` },
  );

  // Transfer an Kandidat B
  const transferB = await stripe.transfers.create(
    {
      amount: split.personBCents,
      currency: cur,
      destination: accounts.personB,
      transfer_group: transferGroup,
      metadata: {
        connectbounty_referral_id: referralId,
        role: "person_b",
      },
    },
    { idempotencyKey: `transfer_${referralId}_person_b` },
  );

  // Transfer an Referrer von A (optional)
  let refOfATransferId: string | null = null;
  if (accounts.refOfA && split.refOfACents > 0) {
    const t = await stripe.transfers.create(
      {
        amount: split.refOfACents,
        currency: cur,
        destination: accounts.refOfA,
        transfer_group: transferGroup,
        metadata: {
          connectbounty_referral_id: referralId,
          role: "ref_of_a",
        },
      },
      { idempotencyKey: `transfer_${referralId}_ref_of_a` },
    );
    refOfATransferId = t.id;
  }

  // Transfer an Referrer von B (optional)
  let refOfBTransferId: string | null = null;
  if (accounts.refOfB && split.refOfBCents > 0) {
    const t = await stripe.transfers.create(
      {
        amount: split.refOfBCents,
        currency: cur,
        destination: accounts.refOfB,
        transfer_group: transferGroup,
        metadata: {
          connectbounty_referral_id: referralId,
          role: "ref_of_b",
        },
      },
      { idempotencyKey: `transfer_${referralId}_ref_of_b` },
    );
    refOfBTransferId = t.id;
  }

  return {
    personATransferId: transferA.id,
    personBTransferId: transferB.id,
    refOfATransferId,
    refOfBTransferId,
  };
}
