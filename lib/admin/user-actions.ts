"use server";

import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAnyRole, logAuditEvent } from "@/lib/auth/roles";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { KycStatus } from "@/lib/supabase/types";

const schema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "unverified", "pending", "expired"]),
});

function formToObject(fd: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

export async function adminSetKycAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin", "kyc_reviewer"]);
  } catch {
    redirect("/login");
  }

  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/users?error=invalid_input");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("profiles")
    .update({ kyc_status: parsed.data.status as KycStatus })
    .eq("id", parsed.data.userId);

  if (error) redirect("/admin/users?error=update_failed");

  try {
    await logAuditEvent({
      action: parsed.data.status === "approved" ? "kyc.approved" : "kyc.rejected",
      targetId: parsed.data.userId,
      metadata: { by: "admin", status: parsed.data.status },
    });
  } catch { /* audit darf nicht blockieren */ }

  revalidatePath("/admin/users");
  redirect("/admin/users?updated=" + parsed.data.userId);
}

// ── Nutzer hard-delete ───────────────────────────────────────────────────

const userIdSchema = z.object({ userId: z.string().uuid() });

export async function adminDeleteUserAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = userIdSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/users?error=invalid_input");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("profiles")
    .delete()
    .eq("id", parsed.data.userId);

  if (error) redirect("/admin/users?error=delete_failed");

  try {
    await logAuditEvent({
      action: "admin.action",
      targetId: parsed.data.userId,
      metadata: { type: "delete_user" },
    });
  } catch { /* audit darf nicht blockieren */ }

  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=" + parsed.data.userId);
}

// ── Nutzer KYC erneut prüfen (→ pending) ─────────────────────────────────

export async function adminReprocessUserAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = userIdSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/users?error=invalid_input");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("profiles")
    .update({ kyc_status: "pending" as KycStatus })
    .eq("id", parsed.data.userId);

  if (error) redirect("/admin/users?error=reprocess_failed");

  try {
    await logAuditEvent({
      action: "admin.action",
      targetId: parsed.data.userId,
      metadata: { type: "reprocess_user_kyc" },
    });
  } catch { /* audit darf nicht blockieren */ }

  revalidatePath("/admin/users");
  redirect("/admin/users?reprocessed=" + parsed.data.userId);
}
