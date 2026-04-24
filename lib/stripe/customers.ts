import "server-only";

import { getStripeClient } from "./client";

export type CompanyCustomerInput = {
  /** Idempotenz-Key: verhindert doppelten Customer bei Retry */
  referralId: string;
  name: string;
  email: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postal_code: string;
    country: string; // ISO 3166-1 alpha-2, z.B. "DE"
  };
  /** Umsatzsteuer-Identifikationsnummer (optional, z.B. "DE123456789") */
  taxId?: string;
};

export type CompanyCustomerResult = {
  customerId: string;
  /** true wenn ein neuer Customer angelegt wurde, false wenn ein bestehender gefunden */
  created: boolean;
};

/**
 * Legt einen Stripe-Customer für die Firma an oder gibt einen bestehenden
 * zurück (idempotent über metadata.referral_id).
 *
 * Idempotenz-Garantie:
 *   Stripe-Customer wird per metadata.connectbounty_referral_id gesucht
 *   bevor ein neuer angelegt wird. Dadurch ist ein Retry nach einem
 *   Netzwerkfehler sicher.
 */
export async function upsertCompanyCustomer(
  input: CompanyCustomerInput,
): Promise<CompanyCustomerResult> {
  const stripe = getStripeClient();

  // Bestehenden Customer für dieses Referral suchen
  const existing = await stripe.customers.search({
    query: `metadata["connectbounty_referral_id"]:"${input.referralId}"`,
    limit: 1,
  });

  const existingCustomer = existing.data[0];
  if (existingCustomer) {
    return { customerId: existingCustomer.id, created: false };
  }

  // Neuen Customer anlegen
  const customer = await stripe.customers.create({
    name: input.name,
    email: input.email,
    address: {
      line1: input.address.line1,
      line2: input.address.line2 ?? undefined,
      city: input.address.city,
      postal_code: input.address.postal_code,
      country: input.address.country,
    },
    metadata: {
      connectbounty_referral_id: input.referralId,
    },
  });

  // Umsatzsteuer-ID anhängen (EU-Validierung durch Stripe)
  if (input.taxId) {
    try {
      await stripe.customers.createTaxId(customer.id, {
        type: "eu_vat",
        value: input.taxId,
      });
    } catch {
      // Ungültige USt-ID: kein Hard-Fehler, nur ohne Tax-ID fortfahren.
      // Admin sieht fehlende Tax-ID auf dem Invoice.
    }
  }

  return { customerId: customer.id, created: true };
}
