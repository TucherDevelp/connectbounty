"use server";

import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAnyRole, logAuditEvent } from "@/lib/auth/roles";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });

function formToObject(fd: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

async function auditSafe(
  action: Parameters<typeof logAuditEvent>[0]["action"],
  targetId: string,
  metadata: Record<string, string> = {},
) {
  try {
    await logAuditEvent({ action, targetId, metadata });
  } catch { /* Audit darf nicht blockieren */ }
}

// ── Referral genehmigen (pending_review → submitted) ─────────────────────

export async function adminApproveReferralAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin", "moderator"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/referrals?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("bounty_referrals")
    .update({ status: "submitted" })
    .eq("id", parsed.data.id)
    .eq("status", "pending_review");

  if (error) redirect("/admin/referrals?error=approve_failed");

  await auditSafe("referral.approved", parsed.data.id);

  revalidatePath("/admin/referrals");
  redirect("/admin/referrals?approved=" + parsed.data.id);
}

// ── Referral ablehnen (pending_review → rejected) ────────────────────────

export async function adminRejectReferralAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin", "moderator"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/referrals?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("bounty_referrals")
    .update({ status: "rejected" })
    .eq("id", parsed.data.id)
    .eq("status", "pending_review");

  if (error) redirect("/admin/referrals?error=reject_failed");

  await auditSafe("admin.action", parsed.data.id, { type: "reject_referral" });

  revalidatePath("/admin/referrals");
  redirect("/admin/referrals?rejected=" + parsed.data.id);
}

// ── Referral hard-delete ──────────────────────────────────────────────────

export async function adminDeleteReferralAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/referrals?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("bounty_referrals")
    .delete()
    .eq("id", parsed.data.id);

  if (error) redirect("/admin/referrals?error=delete_failed");

  await auditSafe("referral.deleted", parsed.data.id, { by: "admin" });

  revalidatePath("/admin/referrals");
  redirect("/admin/referrals?deleted=" + parsed.data.id);
}
