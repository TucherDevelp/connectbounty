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

// ── Bounty genehmigen (pending_review → open) ─────────────────────────────

export async function adminApproveBountyAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin", "moderator"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/bounties?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  const { error } = await sb
    .from("bounties")
    .update({ status: "open", published_at: now })
    .eq("id", parsed.data.id)
    .eq("status", "pending_review");

  if (error) redirect("/admin/bounties?error=approve_failed");

  await auditSafe("bounty.approved", parsed.data.id);

  revalidatePath("/admin/bounties");
  revalidatePath("/bounties");
  revalidatePath("/bounties/mine");
  redirect("/admin/bounties?approved=" + parsed.data.id);
}

// ── Bounty ablehnen (pending_review → cancelled) ──────────────────────────

export async function adminRejectBountyAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin", "moderator"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/bounties?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  const { error } = await sb
    .from("bounties")
    .update({ status: "cancelled", closed_at: now })
    .eq("id", parsed.data.id)
    .eq("status", "pending_review");

  if (error) redirect("/admin/bounties?error=reject_failed");

  await auditSafe("bounty.rejected", parsed.data.id);

  revalidatePath("/admin/bounties");
  revalidatePath("/bounties/mine");
  redirect("/admin/bounties?rejected=" + parsed.data.id);
}

// ── Bounty schließen (open → closed) ─────────────────────────────────────

export async function adminCloseBountyAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin", "moderator"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/bounties?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("bounties")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("status", "open");

  if (error) redirect("/admin/bounties?error=close_failed");

  await auditSafe("admin.action", parsed.data.id, { type: "close_bounty" });

  revalidatePath("/admin/bounties");
  revalidatePath("/bounties");
  redirect("/admin/bounties?closed=" + parsed.data.id);
}

// ── Bounty hard-delete (alle Status) ─────────────────────────────────────

export async function adminDeleteBountyAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/bounties?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("bounties")
    .delete()
    .eq("id", parsed.data.id);

  if (error) redirect("/admin/bounties?error=delete_failed");

  await auditSafe("bounty.deleted", parsed.data.id, { by: "admin" });

  revalidatePath("/admin/bounties");
  revalidatePath("/bounties");
  redirect("/admin/bounties?deleted=" + parsed.data.id);
}

// ── Bounty erneut prüfen (beliebiger Status → pending_review) ────────────

export async function adminReprocessBountyAction(formData: FormData): Promise<void> {
  try {
    await requireAnyRole(["admin", "superadmin"]);
  } catch {
    redirect("/login");
  }

  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/admin/bounties?error=invalid_id");

  const sb = getSupabaseServiceRoleClient();
  const { error } = await sb
    .from("bounties")
    .update({ status: "pending_review", published_at: null, closed_at: null })
    .eq("id", parsed.data.id);

  if (error) redirect("/admin/bounties?error=reprocess_failed");

  await auditSafe("admin.action", parsed.data.id, { type: "reprocess_bounty" });

  revalidatePath("/admin/bounties");
  revalidatePath("/bounties");
  redirect("/admin/bounties?reprocessed=" + parsed.data.id);
}
