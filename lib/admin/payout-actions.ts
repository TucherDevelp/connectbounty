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
 * Admin: Legacy-Direktzahlung an den Referrer (Recruiter) via Stripe Connect.
 * Nur für den alten Pre-V7-Flow; ab V7 wird die Invoice-Split-Methode verwendet.
 *
 * Persona-Hinweis:
 *   bounty_referrals.referrer_id = der REFERRER (Recruiter, der den Kandidaten
 *   auf die Plattform gebracht hat) — NICHT der Inserent (Bounty-Ersteller).
 *   In `payouts.inserent_id` wird hier die Bounty-Owner-ID eingetragen.
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

  // Referral laden (inkl. Bounty-Owner für inserent_id-Pflichtfeld)
  const { data: referral } = await sb
    .from("bounty_referrals")
    .select("id, status, referrer_id, bounty_id, bounties(owner_id)")
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

  // `inserent_id` = Bounty-Owner; der Zahlungsempfänger hier ist der Referrer,
  // was durch `stripe_account_id` + `stripe_transfer_id` reflektiert wird.
  const inserentId = (referral.bounties as { owner_id: string } | null)?.owner_id ?? referral.referrer_id;
  const { error: dbError } = await sb.from("payouts").insert({
    referral_id: referralId,
    bounty_id: referral.bounty_id,
    inserent_id: inserentId,
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
