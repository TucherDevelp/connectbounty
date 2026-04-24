"use server";

import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAnyRole, logAuditEvent } from "@/lib/auth/roles";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createPayout } from "@/lib/stripe/connect";
import { z } from "zod";
import type { Json } from "@/lib/supabase/types";

const payoutSchema = z.object({
  referralId: z.string().uuid(),
  amountCents: z.coerce.number().int().positive(),
  currency: z.string().length(3).default("EUR"),
});

/**
 * Admin: Zahlt eine Prämie an den Referrer aus via Stripe Connect Transfer.
 *
 * Ablauf:
 *   1. Referral → Status muss "hired" sein
 *   2. Referrer muss einen aktiven Connect-Account haben (payouts_enabled)
 *   3. Stripe Transfer erstellen
 *   4. payouts-Eintrag in DB anlegen (Status "processing")
 *   5. Audit-Log
 */
export async function adminCreatePayoutAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = payoutSchema.safeParse({
    referralId: formData.get("referralId"),
    amountCents: formData.get("amountCents"),
    currency: formData.get("currency") ?? "EUR",
  });

  if (!parsed.success) {
    redirect("/admin/referrals?error=invalid_payout_input");
  }

  const { referralId, amountCents, currency } = parsed.data;
  const sb = getSupabaseServiceRoleClient();

  // Referral laden
  const { data: referral } = await sb
    .from("bounty_referrals")
    .select("id, status, referrer_id, bounty_id")
    .eq("id", referralId)
    .maybeSingle();

  if (!referral || referral.status !== "hired") {
    redirect("/admin/referrals?error=referral_not_hired");
  }

  // Connect-Account des Referrers laden
  const { data: connect } = await sb
    .from("stripe_connect_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("user_id", referral.referrer_id)
    .maybeSingle();

  if (!connect?.stripe_account_id || !connect.payouts_enabled) {
    redirect("/admin/referrals?error=no_stripe_account");
  }

  // Bestehenden ausstehenden Payout verhindern (Idempotenz)
  const { data: existingPayout } = await sb
    .from("payouts")
    .select("id, status")
    .eq("referral_id", referralId)
    .in("status", ["pending", "processing", "paid"])
    .maybeSingle();

  if (existingPayout) {
    redirect(`/admin/referrals?error=payout_already_exists`);
  }

  // Stripe Transfer
  let transferId: string;
  let netAmountCents: number;

  try {
    const result = await createPayout({
      stripeAccountId: connect.stripe_account_id,
      amountCents,
      currency,
      metadata: {
        referral_id: referralId,
        bounty_id: referral.bounty_id,
        referrer_id: referral.referrer_id,
      },
    });
    transferId = result.transferId;
    netAmountCents = result.netAmountCents;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe-Fehler";
    console.error("[admin-payout] stripe error:", msg);
    redirect(`/admin/referrals?error=stripe_failed`);
  }

  // Payout in DB anlegen
  const { error: dbError } = await sb.from("payouts").insert({
    referral_id: referralId,
    bounty_id: referral.bounty_id,
    referrer_id: referral.referrer_id,
    amount: netAmountCents / 100,
    currency: currency.toUpperCase(),
    status: "processing",
    stripe_account_id: connect.stripe_account_id,
    stripe_transfer_id: transferId,
  });

  if (dbError) {
    console.error("[admin-payout] db error:", dbError.message);
    redirect("/admin/referrals?error=db_failed");
  }

  // Audit-Log
  try {
    const meta: Json = {
      referralId,
      transferId,
      amountCents,
      netAmountCents,
      currency,
      stripeAccountId: connect.stripe_account_id,
    };
    await logAuditEvent({
      action: "payout.created",
      targetId: referral.referrer_id,
      metadata: meta,
    });
  } catch { /* non-blocking */ }

  revalidatePath("/admin/referrals");
  revalidatePath("/payouts");
  redirect("/admin/referrals?payout_created=" + referralId);
}
