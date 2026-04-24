import "server-only";

import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

let cached: Stripe | null = null;

/**
 * Gibt einen initialisierten Stripe-Client zurück.
 * Wirft einen klaren Fehler wenn STRIPE_SECRET_KEY nicht gesetzt ist.
 */
export function getStripeClient(): Stripe {
  if (cached) return cached;

  const key = serverEnv().STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY fehlt in .env.local. " +
        "Trage deinen Stripe Test-Key (sk_test_...) ein.",
    );
  }

  cached = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: {
      name: "ConnectBounty",
      version: "1.0.0",
    },
  });

  return cached;
}

/** Nur für Tests. */
export function __resetStripeClientCache(): void {
  cached = null;
}
