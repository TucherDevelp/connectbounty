import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/auth/roles";
import {
  computeFixedSplit,
  assertFixedSplit,
  FIXED_SPLIT_CONFIG,
} from "./split";
import { upsertCompanyCustomer } from "./customers";
import { createBonusInvoice } from "./invoices";
import { createSplitTransfers } from "./transfers";

export type OrchestratorResult =
  | { kind: "already_processed"; payoutId: string }
  | { kind: "invoice_created"; invoiceId: string; hostedUrl: string }
  | { kind: "transfers_dispatched"; payoutId: string }
  | { kind: "blocked"; reason: string };

/**
 * Zentraler Payout-Trigger. Idempotent - kann mehrfach aufgerufen werden.
 *
 * Ablauf:
 *   1. Lädt Referral + Bounty + Profile (A, B, Referrer-A, Referrer-B) +
 *      Connect-Accounts aus der DB.
 *   2. Prüft alle Preconditions (Guards).
 *   3. Legt payouts-Row an (oder gibt bestehende zurück).
 *   4. Erstellt Stripe-Customer für Firma + Invoice.
 *   5. Persistiert Invoice-ID in payouts.
 *   6. Der Geld-Eingang via Webhook `invoice.paid` triggert dann
 *      `dispatchSplitTransfers()` (Phase 2 dieser Funktion).
 *
 * `dispatchSplitTransfers()` wird vom Webhook-Handler aufgerufen und
 * führt die Split-Transfers aus, sobald die Invoice bezahlt wurde.
 */
export async function triggerSplitPayout(referralId: string): Promise<OrchestratorResult> {
  const sb = getSupabaseServiceRoleClient();

  // ── 1. Referral laden ──────────────────────────────────────────────────
  const { data: referral, error: refErr } = await sb
    .from("bounty_referrals")
    .select(`
      id, bounty_id, referrer_id, candidate_user_id,
      all_confirmations_done, status,
      company_name, company_billing_email, company_billing_address,
      company_tax_id, company_billing_id
    `)
    .eq("id", referralId)
    .single();

  if (refErr || !referral) {
    return { kind: "blocked", reason: "Referral nicht gefunden." };
  }

  // ── 2. Precondition-Guards ─────────────────────────────────────────────
  if (!referral.all_confirmations_done) {
    return { kind: "blocked", reason: "Nicht alle Bestätigungen liegen vor." };
  }
  if (
    referral.status !== "awaiting_data_forwarding" &&
    referral.status !== "invoice_pending" &&
    referral.status !== "invoice_paid"
  ) {
    return {
      kind: "blocked",
      reason: `Unerwarteter Referral-Status: ${referral.status}.`,
    };
  }
  if (!referral.company_billing_email || !referral.company_name) {
    return { kind: "blocked", reason: "Firmendaten (Name/E-Mail) fehlen." };
  }

  // ── 3. Idempotenz: bestehenden Payout zurückgeben ─────────────────────
  const { data: existingPayout } = await sb
    .from("payouts")
    .select("id, invoice_id, invoice_hosted_url, status")
    .eq("referral_id", referralId)
    .maybeSingle();

  if (existingPayout?.status === "paid") {
    return { kind: "already_processed", payoutId: existingPayout.id };
  }
  if (existingPayout?.invoice_id && existingPayout.status !== "failed") {
    return {
      kind: "invoice_created",
      invoiceId: existingPayout.invoice_id,
      hostedUrl: existingPayout.invoice_hosted_url ?? "",
    };
  }

  // ── 4. Bounty laden ────────────────────────────────────────────────────
  const { data: bounty } = await sb
    .from("bounties")
    .select("id, owner_id, bonus_amount, bonus_currency, split_inserent_bps, split_candidate_bps, split_platform_bps")
    .eq("id", referral.bounty_id)
    .single();

  if (!bounty) {
    return { kind: "blocked", reason: "Bounty nicht gefunden." };
  }

  // ── 5. Referrer-IDs aus DB-Funktion holen ─────────────────────────────
  const { data: referrerPair } = await sb
    .rpc("get_referrer_pair", { p_referral: referralId });

  const referrerOfA: string | null = referrerPair?.[0]?.referrer_of_a ?? null;
  const referrerOfB: string | null = referrerPair?.[0]?.referrer_of_b ?? null;

  // ── 6. Connect-Accounts laden ─────────────────────────────────────────
  const userIds = [
    bounty.owner_id,
    referral.candidate_user_id,
    referrerOfA,
    referrerOfB,
  ].filter(Boolean) as string[];

  const { data: connectAccounts } = await sb
    .from("stripe_connect_accounts")
    .select("user_id, stripe_account_id, payouts_enabled")
    .in("user_id", userIds);

  const accountMap = new Map(
    (connectAccounts ?? []).map((a) => [a.user_id, a]),
  );

  const acctA = accountMap.get(bounty.owner_id);
  const acctB = referral.candidate_user_id
    ? accountMap.get(referral.candidate_user_id)
    : null;

  if (!acctA?.payouts_enabled || !acctA.stripe_account_id) {
    return { kind: "blocked", reason: "Inserent A hat kein aktives Stripe-Konto." };
  }
  if (!acctB?.payouts_enabled || !acctB.stripe_account_id) {
    return { kind: "blocked", reason: "Kandidat B hat kein aktives Stripe-Konto." };
  }

  // ── 7. Split berechnen (verbindlicher Konzept-Schlüssel 40/35/5/20) ──
  // Defense-in-Depth: Falls DB-Splits über eine andere Codeschicht modifiziert
  // wurden, blockieren wir den Payout statt mit abweichendem Schlüssel zu zahlen.
  // `split_inserent_bps` nach Migration 0013 (vorher: `split_referrer_bps`).
  try {
    assertFixedSplit({
      inserentBps: bounty.split_inserent_bps,
      candidateBps: bounty.split_candidate_bps,
      platformBps: bounty.split_platform_bps,
    });
  } catch (err) {
    return {
      kind: "blocked",
      reason: `Split-Konfiguration der Bounty entspricht nicht dem Konzept-Schlüssel ` +
        `(Inserent=${FIXED_SPLIT_CONFIG.inserentBps}/Kandidat=${FIXED_SPLIT_CONFIG.candidateBps}/Plattform=${FIXED_SPLIT_CONFIG.platformBps}). ` +
        `Details: ${(err as Error).message}`,
    };
  }

  const totalCents = Math.round(Number(bounty.bonus_amount) * 100);
  const fixedSplit = computeFixedSplit({
    totalCents,
    hasReferrerOfInserent: referrerOfA !== null && accountMap.has(referrerOfA),
    hasReferrerOfCandidate: referrerOfB !== null && accountMap.has(referrerOfB),
  });
  // Legacy-Feldnamen auf payouts-Tabelle (amount_*_cents) - 1:1-Mapping.
  const split = {
    personACents: fixedSplit.inserentCents,
    personBCents: fixedSplit.candidateCents,
    refOfACents: fixedSplit.referrerOfInserentCents,
    refOfBCents: fixedSplit.referrerOfCandidateCents,
    platformCents: fixedSplit.platformCents,
    totalCents: fixedSplit.totalCents,
  };

  // ── 8. Payout-Row anlegen (oder Update bei Retry) ─────────────────────
  const currency = bounty.bonus_currency.toLowerCase();

  if (!existingPayout) {
    await sb.from("payouts").insert({
      referral_id: referralId,
      bounty_id: bounty.id,
      inserent_id: bounty.owner_id,
      stripe_account_id: acctA.stripe_account_id,
      amount: bounty.bonus_amount,
      currency: bounty.bonus_currency,
      status: "pending",
      total_cents: totalCents,
      amount_inserent_cents: split.personACents,
      amount_candidate_cents: split.personBCents,
      amount_ref_of_a_cents: split.refOfACents,
      amount_ref_of_b_cents: split.refOfBCents,
      amount_platform_fee_cents: split.platformCents,
      capture_method: "automatic",
    });
  }

  // ── 9. Firmenkunden-Upsert ─────────────────────────────────────────────
  const billingAddress = referral.company_billing_address as {
    line1: string;
    line2?: string;
    city: string;
    postal_code: string;
    country: string;
  } | null;

  const { customerId } = await upsertCompanyCustomer({
    referralId,
    name: referral.company_name,
    email: referral.company_billing_email,
    address: billingAddress ?? { line1: "", city: "", postal_code: "", country: "DE" },
    taxId: referral.company_tax_id ?? undefined,
  });

  // Billing-ID in Referral speichern
  await sb
    .from("bounty_referrals")
    .update({ company_billing_id: customerId })
    .eq("id", referralId);

  // ── 10. Invoice erstellen + senden ────────────────────────────────────
  const invoice = await createBonusInvoice({
    customerId,
    totalCents,
    currency,
    description: `Vermittlungsprovision - Bounty ${bounty.id} (Referral ${referralId})`,
    bountyId: bounty.id,
    referralId,
  });

  // ── 11. Invoice-ID + transfer_group persistieren ──────────────────────
  const transferGroup = `inv_${invoice.invoiceId}`;
  await sb
    .from("payouts")
    .update({
      invoice_id: invoice.invoiceId,
      invoice_hosted_url: invoice.hostedInvoiceUrl,
      transfer_group: transferGroup,
      status: "pending",
    })
    .eq("referral_id", referralId);

  // Referral-Status aktualisieren
  await sb
    .from("bounty_referrals")
    .update({
      status: "invoice_pending",
      payment_window_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", referralId);

  // ── 12. Audit-Log ─────────────────────────────────────────────────────
  try {
    await logAuditEvent({
      action: "payout.invoice_created",
      targetId: referralId,
      metadata: {
        invoice_id: invoice.invoiceId,
        total_cents: totalCents,
        bounty_id: bounty.id,
      },
    });
  } catch { /* non-blocking */ }

  return {
    kind: "invoice_created",
    invoiceId: invoice.invoiceId,
    hostedUrl: invoice.hostedInvoiceUrl,
  };
}

/**
 * Phase 2 - wird vom Webhook-Handler nach `invoice.paid` aufgerufen.
 * Führt die Split-Transfers durch und aktualisiert payouts + referral.
 */
export async function dispatchSplitTransfers(opts: {
  invoiceId: string;
  referralId: string;
}): Promise<void> {
  const sb = getSupabaseServiceRoleClient();

  // `inserent_id` = bounty.owner_id, gespeichert beim ursprünglichen Payout-Insert.
  const { data: payout } = await sb
    .from("payouts")
    .select("id, status, transfer_group, inserent_id, amount_inserent_cents, amount_candidate_cents, amount_ref_of_a_cents, amount_ref_of_b_cents, currency")
    .eq("referral_id", opts.referralId)
    .maybeSingle();

  if (!payout) throw new Error("Kein Payout-Eintrag für dieses Referral gefunden.");
  if (payout.status === "paid") return; // bereits abgeschlossen - idempotent

  // Nur Kandidat + Referrer-Paar aus bounty_referrals laden.
  // Die Inserenten-ID kommt sicher aus payout.referrer_id (= bounty.owner_id beim Insert).
  const { data: referral } = await sb
    .from("bounty_referrals")
    .select("bounty_id, candidate_user_id")
    .eq("id", opts.referralId)
    .single();

  if (!referral) throw new Error("Referral nicht gefunden.");

  const referrerPair = await sb.rpc("get_referrer_pair", { p_referral: opts.referralId });
  const referrerOfA: string | null = referrerPair.data?.[0]?.referrer_of_a ?? null;
  const referrerOfB: string | null = referrerPair.data?.[0]?.referrer_of_b ?? null;

  const inserentId: string = payout.inserent_id;

  const userIds = [
    inserentId,
    referral.candidate_user_id,
    referrerOfA,
    referrerOfB,
  ].filter(Boolean) as string[];

  const { data: connectAccounts } = await sb
    .from("stripe_connect_accounts")
    .select("user_id, stripe_account_id, payouts_enabled")
    .in("user_id", userIds);

  const accountMap = new Map(
    (connectAccounts ?? []).map((a) => [a.user_id, a]),
  );

  // acctA = Inserent-Konto (40 % Anteil)
  const acctA = accountMap.get(inserentId);
  // acctB = Kandidaten-Konto (35 % Anteil)
  const acctB = referral.candidate_user_id ? accountMap.get(referral.candidate_user_id) : null;
  const acctRefA = referrerOfA ? accountMap.get(referrerOfA) : null;
  const acctRefB = referrerOfB ? accountMap.get(referrerOfB) : null;

  if (!acctA?.stripe_account_id || !acctB?.stripe_account_id) {
    throw new Error("Connect-Accounts für A oder B nicht gefunden.");
  }

  const splitResult = {
    personACents: payout.amount_inserent_cents ?? 0,
    personBCents: payout.amount_candidate_cents ?? 0,
    refOfACents: payout.amount_ref_of_a_cents ?? 0,
    refOfBCents: payout.amount_ref_of_b_cents ?? 0,
    platformCents: 0, // bleibt auf Platform-Balance, kein Transfer nötig
    totalCents: 0,    // nicht benötigt hier
  };

  const transfers = await createSplitTransfers({
    referralId: opts.referralId,
    transferGroup: payout.transfer_group ?? `inv_${opts.invoiceId}`,
    currency: payout.currency ?? "eur",
    split: splitResult,
    accounts: {
      personA: acctA.stripe_account_id,
      personB: acctB.stripe_account_id,
      refOfA: acctRefA?.stripe_account_id ?? null,
      refOfB: acctRefB?.stripe_account_id ?? null,
    },
  });

  // Transfer-IDs + Status persistieren
  await sb
    .from("payouts")
    .update({
      status: "processing",
      inserent_transfer_id: transfers.personATransferId,
      candidate_transfer_id: transfers.personBTransferId,
      ref_of_a_transfer_id: transfers.refOfATransferId,
      ref_of_b_transfer_id: transfers.refOfBTransferId,
      payment_intent_id: opts.invoiceId,
    })
    .eq("id", payout.id);

  await sb
    .from("bounty_referrals")
    .update({ status: "invoice_paid" })
    .eq("id", opts.referralId);

  try {
    await logAuditEvent({
      action: "payout.transfers_dispatched",
      targetId: opts.referralId,
      metadata: {
        invoice_id: opts.invoiceId,
        transfer_a: transfers.personATransferId,
        transfer_b: transfers.personBTransferId,
      },
    });
  } catch { /* non-blocking */ }
}
