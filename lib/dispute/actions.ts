"use server";
import "server-only";

import { z } from "zod";
import { cookies } from "next/headers";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireAnyRole, requireUser, logAuditEvent } from "@/lib/auth/roles";
import { actionOk, actionError, fieldErrorsFromZod } from "@/lib/auth/action-result";
import type { ActionState } from "@/lib/auth/action-result";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";

function resolveSchema(lang: Lang) {
  return z.object({
    disputeId: z.string().uuid(),
    decision: z.enum(["pay", "reject"]),
    resolution: z.string().min(20, t(lang, "admin_disputes_zod_resolution_min")).max(2000),
  });
}

/**
 * Admin löst einen Dispute auf.
 *   - decision = "pay"    → Referral-Status → 'paid',   Payout wird erneut ausgelöst.
 *   - decision = "reject" → Referral-Status → 'rejected' (endgültig).
 *
 * Nur Admins / Support dürfen diese Action aufrufen (requireRole-Guard).
 */
export async function resolveDisputeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "error_dispute_unauthorized"));
  try {
    await requireAnyRole(["admin", "superadmin", "support"] as const);
  } catch {
    return actionError(t(lang, "error_dispute_unauthorized"));
  }

  const parsed = resolveSchema(lang).safeParse({
    disputeId: formData.get("disputeId"),
    decision: formData.get("decision"),
    resolution: formData.get("resolution"),
  });
  if (!parsed.success) {
    return actionError(t(lang, "error_dispute_invalid_input"), fieldErrorsFromZod(parsed.error.issues));
  }

  const { disputeId, decision, resolution } = parsed.data;
  const sb = getSupabaseServiceRoleClient();

  // Dispute laden
  const { data: dispute } = await sb
    .from("bounty_disputes")
    .select("id, referral_id, status")
    .eq("id", disputeId)
    .eq("status", "open")
    .maybeSingle();

  if (!dispute) return actionError(t(lang, "error_dispute_not_found"));

  const newReferralStatus = decision === "pay" ? "invoice_pending" : "rejected";

  // Dispute schließen
  const { error: disputeErr } = await sb
    .from("bounty_disputes")
    .update({
      status: decision === "pay" ? "resolved" : "dismissed",
      resolver_id: user.id,
      resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId);

  if (disputeErr) return actionError(t(lang, "error_dispute_update_failed"));

  // Referral-Status zurücksetzen
  const { error: referralErr } = await sb
    .from("bounty_referrals")
    .update({ status: newReferralStatus })
    .eq("id", dispute.referral_id);

  if (referralErr) return actionError(t(lang, "error_referral_status_update_failed"));

  await logAuditEvent({
    action: "referral.dispute_resolved",
    targetId: dispute.referral_id,
    metadata: { dispute_id: disputeId, decision, resolution },
  });

  return actionOk(
    decision === "pay"
      ? t(lang, "success_dispute_resolved_pay")
      : t(lang, "success_dispute_rejected"),
  );
}
