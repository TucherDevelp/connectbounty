"use server";

import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  KycRequiredError,
  UnauthenticatedError,
  logAuditEvent,
  requireKycApproved,
  requireUser,
} from "@/lib/auth/roles";
import type { AuditAction, Json } from "@/lib/supabase/types";
import {
  actionError,
  fieldErrorsFromZod,
  type ActionState,
} from "@/lib/auth/action-result";
import { t } from "@/lib/i18n";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { bountyIdSchema, createBountyCreateSchema } from "./schemas";

/**
 * Server Actions für den Bounty-Lifecycle.
 *
 * Verantwortung ist klar getrennt:
 *   • Action = Auth-/KYC-Guard, Validierung, DB-Insert, Audit, Redirect
 *   • DB     = Endgültige Constraints + RLS
 *   • UI     = Forms + optimistisches Feedback
 *
 * Fehler-Leaks vermeiden: detaillierte Fehler aus Supabase (z. B. RLS)
 * werden NICHT 1:1 an den Client weitergegeben.
 */

function safeFormDataToObject(fd: FormData): Record<string, FormDataEntryValue> {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

async function auditSafe(
  action: AuditAction,
  targetId?: string,
  metadata: Json = {},
): Promise<void> {
  try {
    await logAuditEvent({ action, targetId, metadata });
  } catch {
    // Audit-Fehler sollen die Haupt-Transaktion nicht blockieren.
  }
}

// ── Bounty anlegen (status = draft) ────────────────────────────────────────

export async function createBountyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

  try {
    await requireKycApproved();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return actionError(t(lang, "bounty_action_login"));
    }
    if (err instanceof KycRequiredError) {
      return actionError(t(lang, "bounty_action_kyc"));
    }
    throw err;
  }

  const parsed = createBountyCreateSchema(lang).safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    return actionError(
      t(lang, "bounty_action_check_input"),
      fieldErrorsFromZod(parsed.error.issues),
    );
  }

  const supabase = await getSupabaseServerClient();
  const user = await requireUser();

  const { data, error } = await supabase
    .from("bounties")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      bonus_amount: parsed.data.bonusAmount,
      bonus_currency: parsed.data.bonusCurrency,
      location: parsed.data.location,
      industry: parsed.data.industry,
      tags: parsed.data.tags,
      expires_at: parsed.data.expiresAt,
      split_inserent_bps: parsed.data.splitInserentBps,
      split_candidate_bps: parsed.data.splitCandidateBps,
      split_platform_bps: parsed.data.splitPlatformBps,
      payment_mode: parsed.data.paymentMode,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return actionError(t(lang, "bounty_action_save_failed"));
  }

  await auditSafe("bounty.created", data.id, {
    title: parsed.data.title,
    bonus_amount: parsed.data.bonusAmount,
    bonus_currency: parsed.data.bonusCurrency,
  });

  revalidatePath("/bounties/mine");
  redirect(`/bounties/mine?created=${data.id}`);
}

// ── Bounty veröffentlichen (draft → open) ──────────────────────────────────

export async function publishBountyAction(formData: FormData): Promise<void> {
  const parsed = bountyIdSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    redirect("/bounties/mine?error=invalid_id");
  }

  try {
    await requireKycApproved();
  } catch {
    redirect("/bounties/mine?error=kyc_required");
  }

  const supabase = await getSupabaseServerClient();

  // Bounty geht zur Admin-Prüfung, nicht direkt live.
  const { error } = await supabase
    .from("bounties")
    .update({ status: "pending_review" })
    .eq("id", parsed.data.id)
    .eq("status", "draft");

  if (error) {
    redirect("/bounties/mine?error=publish_failed");
  }

  await auditSafe("bounty.published", parsed.data.id);

  revalidatePath("/bounties/mine");
  revalidatePath("/bounties");
  redirect(`/bounties/mine?pending=${parsed.data.id}`);
}

// ── Bounty schließen (open → closed) ───────────────────────────────────────

export async function closeBountyAction(formData: FormData): Promise<void> {
  const parsed = bountyIdSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    redirect("/bounties/mine?error=invalid_id");
  }

  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("bounties")
    .update({ status: "closed", closed_at: now })
    .eq("id", parsed.data.id)
    .eq("status", "open");

  if (error) {
    redirect("/bounties/mine?error=close_failed");
  }

  await auditSafe("bounty.closed", parsed.data.id);
  revalidatePath("/bounties/mine");
  revalidatePath("/bounties");
  redirect(`/bounties/mine?closed=${parsed.data.id}`);
}

// ── Bounty abbrechen (draft|open → cancelled) ─────────────────────────────

export async function cancelBountyAction(formData: FormData): Promise<void> {
  const parsed = bountyIdSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    redirect("/bounties/mine?error=invalid_id");
  }

  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("bounties")
    .update({ status: "cancelled", closed_at: now })
    .eq("id", parsed.data.id)
    .in("status", ["draft", "pending_review", "open"]);

  if (error) {
    redirect("/bounties/mine?error=cancel_failed");
  }

  await auditSafe("bounty.cancelled", parsed.data.id);
  revalidatePath("/bounties/mine");
  revalidatePath("/bounties");
  redirect(`/bounties/mine?cancelled=${parsed.data.id}`);
}

// ── Bounty löschen (nur draft) ─────────────────────────────────────────────

export async function deleteBountyAction(formData: FormData): Promise<void> {
  const parsed = bountyIdSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    redirect("/bounties/mine?error=invalid_id");
  }

  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();
  // RLS erlaubt DELETE ohnehin nur im Draft-Zustand - Client-seitiger
  // Filter + RLS liefern zusammen eine saubere Doppelabsicherung.
  const { error } = await supabase
    .from("bounties")
    .delete()
    .eq("id", parsed.data.id)
    .eq("status", "draft");

  if (error) {
    redirect("/bounties/mine?error=delete_failed");
  }

  await auditSafe("bounty.deleted", parsed.data.id);
  revalidatePath("/bounties/mine");
  redirect(`/bounties/mine?deleted=${parsed.data.id}`);
}
