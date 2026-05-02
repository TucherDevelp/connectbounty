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

// ── Dispute hard-delete ──────────────────────────────────────────────────

export async function adminDeleteDisputeAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/disputes?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("referral_disputes")
    .delete()
    .eq("id", parsed.data.id);

  if (error) redirect("/admin/disputes?error=delete_failed");

  await auditSafe("admin.action", parsed.data.id, { type: "delete_dispute" });

  revalidatePath("/admin/disputes");
  redirect("/admin/disputes?deleted=" + parsed.data.id);
}

// ── Dispute erneut öffnen (→ open) ───────────────────────────────────────

export async function adminReprocessDisputeAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/disputes?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("referral_disputes")
    .update({ status: "open", resolved_at: null, resolution: null, resolver_id: null })
    .eq("id", parsed.data.id);

  if (error) redirect("/admin/disputes?error=reprocess_failed");

  await auditSafe("admin.action", parsed.data.id, { type: "reprocess_dispute" });

  revalidatePath("/admin/disputes");
  redirect("/admin/disputes?reprocessed=" + parsed.data.id);
}
