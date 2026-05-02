"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyRole, logAuditEvent } from "@/lib/auth/roles";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Json } from "@/lib/supabase/types";

const reviewSchema = z.object({
  applicantId: z.string().min(1),
  userId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  rejectReason: z.string().optional(),
});

/**
 * Admin-seitige KYC-Entscheidung (Approve / Reject).
 * Ruft die bestehende update_kyc_status() DB-Funktion auf - gleicher Pfad
 * wie der echte Webhook-Handler.
 */
export async function adminReviewKycAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin", "kyc_reviewer"]);
  } catch {
    redirect("/login");
  }

  const parsed = reviewSchema.safeParse({
    applicantId: formData.get("applicantId"),
    userId: formData.get("userId"),
    decision: formData.get("decision"),
    rejectReason: formData.get("rejectReason") ?? undefined,
  });

  if (!parsed.success) redirect("/admin/kyc?error=invalid_input");

  const { applicantId, userId, decision, rejectReason } = parsed.data;
  const sb = getSupabaseServiceRoleClient();

  const rejectLabels = rejectReason ? [rejectReason] : null;

  const { error } = await sb.rpc("update_kyc_status", {
    p_applicant_id: applicantId,
    p_status: decision,
    p_review_result: null,
    p_reject_labels: rejectLabels,
  });

  if (error) {
    redirect("/admin/kyc?error=update_failed");
  }

  try {
    const meta: Json = { by: "admin", applicantId, rejectReason: rejectReason ?? null };
    await logAuditEvent({
      action: decision === "approved" ? "kyc.approved" : "kyc.rejected",
      targetId: userId,
      metadata: meta,
    });
  } catch { /* audit darf nicht blockieren */ }

  revalidatePath("/admin/kyc");
  revalidatePath("/admin/users");
  redirect("/admin/kyc?reviewed=" + applicantId);
}

// ── KYC-Antrag löschen (hard-delete) ─────────────────────────────────────

const kycIdSchema = z.object({ applicantId: z.string().min(1) });

export async function adminDeleteKycAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = kycIdSchema.safeParse({
    applicantId: formData.get("applicantId"),
  });
  if (!parsed.success) redirect("/admin/kyc?error=invalid_input");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("kyc_applicants")
    .delete()
    .eq("applicant_id", parsed.data.applicantId);

  if (error) redirect("/admin/kyc?error=delete_failed");

  try {
    await logAuditEvent({
      action: "admin.action",
      targetId: parsed.data.applicantId,
      metadata: { by: "admin", type: "delete_kyc" } as Json,
    });
  } catch { /* audit darf nicht blockieren */ }

  revalidatePath("/admin/kyc");
  revalidatePath("/admin/users");
  redirect("/admin/kyc?deleted=" + parsed.data.applicantId);
}

// ── KYC-Antrag erneut prüfen (→ pending) ─────────────────────────────────

export async function adminReprocessKycAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = kycIdSchema.safeParse({
    applicantId: formData.get("applicantId"),
  });
  if (!parsed.success) redirect("/admin/kyc?error=invalid_input");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("kyc_applicants")
    .update({ status: "pending", reviewed_at: null, reject_labels: null })
    .eq("applicant_id", parsed.data.applicantId);

  if (error) redirect("/admin/kyc?error=reprocess_failed");

  try {
    await logAuditEvent({
      action: "admin.action",
      targetId: parsed.data.applicantId,
      metadata: { type: "reprocess_kyc" } as Json,
    });
  } catch { /* audit darf nicht blockieren */ }

  revalidatePath("/admin/kyc");
  revalidatePath("/admin/users");
  redirect("/admin/kyc?reprocessed=" + parsed.data.applicantId);
}
