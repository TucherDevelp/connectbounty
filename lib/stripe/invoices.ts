import "server-only";

import { getStripeClient } from "./client";

export type BonusInvoiceInput = {
  /** Stripe-Customer-ID der Firma (acq_... oder cus_...) */
  customerId: string;
  /** Gesamtbetrag in Cent */
  totalCents: number;
  currency: string;
  /** Sichtbare Beschreibung auf der Rechnung */
  description: string;
  bountyId: string;
  referralId: string;
  /** Zahlungsziel in Tagen ab Invoice-Erstellung (default 14) */
  dueDays?: number;
};

export type BonusInvoiceResult = {
  invoiceId: string;
  /** Stripe-hosted URL - Firma zahlt direkt über diesen Link */
  hostedInvoiceUrl: string;
  /** PDF-URL für Archivierung */
  invoicePdfUrl: string;
};

/**
 * Erstellt eine Stripe-Invoice für die Firma und sendet sie sofort.
 *
 * Geldfluss-Designentscheidung:
 *   Die Invoice hat KEIN `transfer_data.destination` - das Geld landet auf
 *   dem Plattform-Balance. Erst nach `invoice.paid`-Webhook führt der
 *   Orchestrator die Split-Transfers an die Connect-Accounts aus.
 *   Das ermöglicht atomares Splitting und vermeidet Race-Conditions.
 *
 * Idempotenz:
 *   Sucht eine bestehende Draft/Open-Invoice mit metadata.referral_id
 *   bevor eine neue erstellt wird. Damit ist ein Retry nach Netzwerkfehler sicher.
 */
export async function createBonusInvoice(
  input: BonusInvoiceInput,
): Promise<BonusInvoiceResult> {
  const stripe = getStripeClient();
  const dueDays = input.dueDays ?? 14;

  // Idempotenz: Gibt es bereits eine Invoice für dieses Referral?
  const existingList = await stripe.invoices.list({
    customer: input.customerId,
    limit: 10,
  });
  const existing = existingList.data.find(
    (inv) =>
      inv.metadata?.connectbounty_referral_id === input.referralId &&
      (inv.status === "draft" || inv.status === "open"),
  );
  if (existing) {
    return {
      invoiceId: existing.id,
      hostedInvoiceUrl: existing.hosted_invoice_url ?? "",
      invoicePdfUrl: existing.invoice_pdf ?? "",
    };
  }

  // 1. Invoice-Item anlegen
  await stripe.invoiceItems.create({
    customer: input.customerId,
    amount: input.totalCents,
    currency: input.currency.toLowerCase(),
    description: input.description,
    metadata: {
      connectbounty_bounty_id: input.bountyId,
      connectbounty_referral_id: input.referralId,
    },
  });

  // 2. Invoice erstellen
  const invoice = await stripe.invoices.create({
    customer: input.customerId,
    collection_method: "send_invoice",
    days_until_due: dueDays,
    // Kein transfer_data - Geld bleibt auf Platform-Balance
    metadata: {
      connectbounty_bounty_id: input.bountyId,
      connectbounty_referral_id: input.referralId,
    },
    // Automatische Steuer-Berechnung: deaktiviert (Disclaimer im UI)
    auto_advance: true,
    description: input.description,
  });

  // 3. Finalisieren (Status: draft → open)
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

  // 4. Per Mail an Firma senden
  await stripe.invoices.sendInvoice(finalized.id);

  return {
    invoiceId: finalized.id,
    hostedInvoiceUrl: finalized.hosted_invoice_url ?? "",
    invoicePdfUrl: finalized.invoice_pdf ?? "",
  };
}
