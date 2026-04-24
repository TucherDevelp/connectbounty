import "server-only";

import { getStripeClient } from "./client";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { serverEnv, clientEnv } from "@/lib/env";
import { logAuditEvent } from "@/lib/auth/roles";

export type ConnectAccountStatus = {
  stripeAccountId: string | null;
  onboardingStatus: "pending" | "onboarding" | "active" | "restricted" | "disabled";
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
};

/**
 * Gibt den aktuellen Connect-Account-Status für einen User zurück.
 * Legt keinen neuen Account an.
 */
export async function getConnectAccountStatus(
  userId: string,
): Promise<ConnectAccountStatus | null> {
  const sb = getSupabaseServiceRoleClient();
  const { data } = await sb
    .from("stripe_connect_accounts")
    .select("stripe_account_id, onboarding_status, payouts_enabled, charges_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    stripeAccountId: data.stripe_account_id,
    onboardingStatus: data.onboarding_status as ConnectAccountStatus["onboardingStatus"],
    payoutsEnabled: data.payouts_enabled,
    chargesEnabled: data.charges_enabled,
  };
}

/**
 * Startet das Stripe Connect Express Onboarding für einen User:
 *   1. Legt ggf. einen neuen Express-Account bei Stripe an
 *   2. Speichert die Account-ID in stripe_connect_accounts
 *   3. Generiert einen Account-Link (Onboarding-URL) und gibt ihn zurück
 *
 * Idempotent: bestehende Accounts werden wiederverwendet.
 */
export async function startConnectOnboarding(
  userId: string,
  userEmail: string,
): Promise<string> {
  const stripe = getStripeClient();
  const sb = getSupabaseServiceRoleClient();
  const siteUrl = clientEnv().NEXT_PUBLIC_SITE_URL;

  // Bestehenden Eintrag prüfen
  const { data: existing } = await sb
    .from("stripe_connect_accounts")
    .select("stripe_account_id, onboarding_status")
    .eq("user_id", userId)
    .maybeSingle();

  let stripeAccountId = existing?.stripe_account_id ?? null;

  if (!stripeAccountId) {
    // Neuen Express-Account erstellen
    const account = await stripe.accounts.create({
      type: "express",
      email: userEmail,
      capabilities: {
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: { interval: "manual" },
        },
      },
      metadata: { connectbounty_user_id: userId },
    });

    stripeAccountId = account.id;

    // In DB speichern
    await sb.from("stripe_connect_accounts").upsert(
      {
        user_id: userId,
        stripe_account_id: stripeAccountId,
        onboarding_status: "onboarding",
        payouts_enabled: false,
        charges_enabled: false,
      },
      { onConflict: "user_id" },
    );

    // Audit-Log
    try {
      await logAuditEvent({
        action: "stripe.connect_started",
        targetId: userId,
        metadata: { stripeAccountId },
      });
    } catch { /* non-blocking */ }
  }

  // Account-Link generieren (läuft nach 5 Min ab - immer neu generieren)
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${siteUrl}/payouts?stripe=refresh`,
    return_url: `${siteUrl}/payouts?stripe=return`,
    type: "account_onboarding",
  });

  return accountLink.url;
}

/**
 * Aktualisiert den Connect-Account-Status aus Stripe (nach Webhook oder
 * manuellem Refresh).
 */
export async function syncConnectAccount(stripeAccountId: string): Promise<void> {
  const stripe = getStripeClient();
  const sb = getSupabaseServiceRoleClient();

  const account = await stripe.accounts.retrieve(stripeAccountId);

  const onboardingStatus = deriveOnboardingStatus(account);

  await sb
    .from("stripe_connect_accounts")
    .update({
      onboarding_status: onboardingStatus,
      payouts_enabled: account.payouts_enabled ?? false,
      charges_enabled: account.charges_enabled ?? false,
      last_synced_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", stripeAccountId);

  // Wenn jetzt aktiv: Audit-Log
  if (onboardingStatus === "active") {
    const { data: row } = await sb
      .from("stripe_connect_accounts")
      .select("user_id")
      .eq("stripe_account_id", stripeAccountId)
      .maybeSingle();

    if (row?.user_id) {
      try {
        await logAuditEvent({
          action: "stripe.connect_completed",
          targetId: row.user_id,
          metadata: { stripeAccountId },
        });
      } catch { /* non-blocking */ }
    }
  }
}

/**
 * Leitet den Stripe-Account-Status auf unsere Enum-Werte ab.
 */
function deriveOnboardingStatus(
  account: import("stripe").Stripe.Account,
): ConnectAccountStatus["onboardingStatus"] {
  if (account.payouts_enabled && account.charges_enabled) return "active";
  if (account.requirements?.disabled_reason) return "disabled";
  if (
    account.requirements?.currently_due?.length ||
    account.requirements?.past_due?.length
  ) {
    return "restricted";
  }
  if (account.details_submitted) return "onboarding";
  return "pending";
}

/**
 * Erstellt einen Transfer an einen Connect-Account (Auszahlung).
 * Wird vom Admin ausgelöst, nachdem ein Referral auf "hired" gewechselt ist.
 *
 * @param stripeAccountId  Ziel-Account (acct_...)
 * @param amountCents      Brutto-Betrag in Cent
 * @param currency         ISO-Währungscode (z.B. "eur")
 * @param metadata         Referral-ID, Bounty-ID etc. für Reconciliation
 */
export async function createPayout(opts: {
  stripeAccountId: string;
  amountCents: number;
  currency: string;
  metadata: Record<string, string>;
}): Promise<{ transferId: string; netAmountCents: number }> {
  const stripe = getStripeClient();
  const feePercent = serverEnv().STRIPE_PLATFORM_FEE_PERCENT;

  const feeAmountCents = Math.round(opts.amountCents * (feePercent / 100));
  const netAmountCents = opts.amountCents - feeAmountCents;

  const transfer = await stripe.transfers.create({
    amount: netAmountCents,
    currency: opts.currency.toLowerCase(),
    destination: opts.stripeAccountId,
    metadata: opts.metadata,
  });

  return { transferId: transfer.id, netAmountCents };
}
