"use server";

import "server-only";

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
import type { AuditAction, Json, ReferralStatus } from "@/lib/supabase/types";
import {
  actionError,
  fieldErrorsFromZod,
  type ActionState,
} from "@/lib/auth/action-result";
import {
  referralIdSchema,
  referralStatusUpdateSchema,
  referralSubmitSchema,
} from "./schemas";

/**
 * Server Actions für Empfehlungen (Referrals).
 *
 * Sicherheitsmodell:
 *   • RLS in 0003_marketplace.sql ist die letzte Verteidigungslinie.
 *   • Application-Layer validiert Zod, KYC und Ownership,
 *     liefert aber nur generische Fehlermeldungen (kein RLS-Leak).
 *   • Statusübergänge prüft der DB-Trigger enforce_referral_transition().
 */

function formToObject(fd: FormData): Record<string, FormDataEntryValue> {
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
    // Audit darf Haupt-Transaktion nicht blockieren.
  }
}

// ── Referral einreichen ───────────────────────────────────────────────────

export async function submitReferralAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireKycApproved();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return actionError("Bitte melde dich an.");
    }
    if (err instanceof KycRequiredError) {
      return actionError(
        "Um Empfehlungen abzugeben ist ein erfolgreicher KYC erforderlich.",
      );
    }
    throw err;
  }

  const parsed = referralSubmitSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return actionError(
      "Bitte prüfe deine Eingaben.",
      fieldErrorsFromZod(parsed.error.issues),
    );
  }

  const supabase = await getSupabaseServerClient();
  const user = await requireUser();

  const { data, error } = await supabase
    .from("bounty_referrals")
    .insert({
      bounty_id: parsed.data.bountyId,
      referrer_id: user.id,
      candidate_name: parsed.data.candidateName,
      candidate_email: parsed.data.candidateEmail,
      candidate_contact: parsed.data.candidateContact,
      message: parsed.data.message,
      status: "pending_review" satisfies ReferralStatus,
    })
    .select("id")
    .single();

  if (error || !data) {
    // RLS blockiert u. a. Self-Referral / non-open Bounty / Duplikate.
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      return actionError(
        "Du hast diese E-Mail bereits für diese Bounty empfohlen.",
      );
    }
    return actionError(
      "Empfehlung konnte nicht gespeichert werden. Prüfe, ob die Bounty noch offen ist.",
    );
  }

  await auditSafe("referral.submitted", data.id, {
    bounty_id: parsed.data.bountyId,
  });

  revalidatePath(`/bounties/${parsed.data.bountyId}`);
  revalidatePath("/referrals/mine");
  redirect(`/referrals/mine?submitted=${data.id}`);
}

// ── Referral zurückziehen (referrer) ──────────────────────────────────────

export async function withdrawReferralAction(formData: FormData): Promise<void> {
  const parsed = referralIdSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/referrals/mine?error=invalid_id");

  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("bounty_referrals")
    .update({
      status: "withdrawn" satisfies ReferralStatus,
      status_changed_at: now,
    })
    .eq("id", parsed.data.id)
    .in("status", ["pending_review", "submitted", "contacted", "interviewing"])
    .select("id, bounty_id")
    .maybeSingle();

  if (error || !data) {
    redirect("/referrals/mine?error=withdraw_failed");
  }

  await auditSafe("referral.withdrawn", data.id, { bounty_id: data.bounty_id });

  revalidatePath("/referrals/mine");
  revalidatePath(`/bounties/${data.bounty_id}`);
  redirect(`/referrals/mine?withdrawn=${data.id}`);
}

// ── Status durch Owner aktualisieren ──────────────────────────────────────

export async function updateReferralStatusAction(
  formData: FormData,
): Promise<void> {
  const parsed = referralStatusUpdateSchema.safeParse(formToObject(formData));
  if (!parsed.success) redirect("/bounties/mine?error=invalid_status");

  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();
  const now = new Date().toISOString();
  const patch: {
    status: ReferralStatus;
    status_changed_at: string;
    hired_at?: string;
    paid_at?: string;
  } = { status: parsed.data.status, status_changed_at: now };
  if (parsed.data.status === "hired") patch.hired_at = now;
  if (parsed.data.status === "paid") patch.paid_at = now;

  const { data, error } = await supabase
    .from("bounty_referrals")
    .update(patch)
    .eq("id", parsed.data.id)
    .select("id, bounty_id")
    .maybeSingle();

  if (error || !data) {
    // Trigger enforce_referral_transition liefert bei ungültigen Übergängen einen Fehler.
    redirect(`/bounties/mine?error=status_update_failed`);
  }

  await auditSafe("referral.status_changed", data.id, {
    bounty_id: data.bounty_id,
    to: parsed.data.status,
  });

  revalidatePath(`/bounties/${data.bounty_id}`);
  revalidatePath("/bounties/mine");
  redirect(`/bounties/${data.bounty_id}?status_updated=${data.id}`);
}
