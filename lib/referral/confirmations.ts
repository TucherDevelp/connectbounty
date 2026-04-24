"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser, logAuditEvent } from "@/lib/auth/roles";
import {
  actionError,
  actionOk,
  fieldErrorsFromZod,
  type ActionState,
} from "@/lib/auth/action-result";
import {
  claimHireSchema,
  hireProofUploadSchema,
  confirmClaimSchema,
  confirmPayoutAccountSchema,
  confirmDataForwardedSchema,
  rejectionSchema,
  disputeOpenSchema,
} from "./schemas";
import { triggerSplitPayout } from "@/lib/stripe/payout-orchestrator";

function toObj(fd: FormData): Record<string, FormDataEntryValue> {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

// ── Schritt 4: B legt Referral mit Status "awaiting_hire_proof" an ─────────

/**
 * B klickt „Ich wurde eingestellt" und wählt das Inserat.
 * Legt ein Referral an (oder gibt ein bestehendes zurück) mit
 * status = awaiting_hire_proof.
 */
export async function claimHireAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser().catch(() => null);
  if (!user) return actionError("Bitte melde dich an.");

  const parsed = claimHireSchema.safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError("Ungültige Eingaben.", fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();

  // Prüfen ob Bounty open ist
  const { data: bounty } = await supabase
    .from("bounties")
    .select("id, owner_id, status")
    .eq("id", parsed.data.bountyId)
    .eq("status", "open")
    .maybeSingle();

  if (!bounty) {
    return actionError("Inserat nicht gefunden oder nicht mehr offen.");
  }
  if (bounty.owner_id === user.id) {
    return actionError("Du kannst nicht dein eigenes Inserat beanspruchen.");
  }

  // Bereits ein Referral für diesen User + Bounty?
  const { data: existing } = await supabase
    .from("bounty_referrals")
    .select("id, status")
    .eq("bounty_id", parsed.data.bountyId)
    .eq("candidate_user_id", user.id)
    .maybeSingle();

  if (existing) {
    return actionOk(`Referral existiert bereits (Status: ${existing.status}).`);
  }

  const { data, error } = await supabase
    .from("bounty_referrals")
    .insert({
      bounty_id: parsed.data.bountyId,
      referrer_id: bounty.owner_id, // A ist technisch der "Referrer" (Besitzer)
      candidate_user_id: user.id,
      candidate_name: user.email ?? "Unbekannt",
      candidate_email: user.email ?? "",
      message: parsed.data.note,
      status: "awaiting_hire_proof",
    })
    .select("id")
    .single();

  if (error || !data) {
    return actionError("Referral konnte nicht angelegt werden.");
  }

  try {
    await logAuditEvent({ action: "referral.submitted", targetId: data.id, metadata: { bounty_id: parsed.data.bountyId } });
  } catch { /* non-blocking */ }

  revalidatePath("/referrals/mine");
  return actionOk(data.id);
}

// ── Schritt 5: B lädt Hire-Proof hoch ──────────────────────────────────────

export async function uploadHireProofAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser().catch(() => null);
  if (!user) return actionError("Bitte melde dich an.");

  const parsed = hireProofUploadSchema.safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError("Ungültige Eingaben.", fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();

  // Ownership: nur der Kandidat darf seinen eigenen Hire-Proof hochladen
  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, status, candidate_user_id, bounty_id")
    .eq("id", parsed.data.referralId)
    .eq("candidate_user_id", user.id)
    .eq("status", "awaiting_hire_proof")
    .maybeSingle();

  if (!referral) {
    return actionError("Referral nicht gefunden oder du bist nicht berechtigt.");
  }

  // Hire-Proof-Dokument speichern (Metadaten; Upload in Bucket läuft client-seitig)
  const { error: docError } = await supabase
    .from("hire_proof_documents")
    .insert({
      referral_id: referral.id,
      user_id: user.id,
      storage_path: parsed.data.storagePath,
      mime_type: parsed.data.mimeType,
      file_size: parsed.data.fileSize,
    });

  if (docError) {
    return actionError("Dokument konnte nicht gespeichert werden.");
  }

  // Referral-Status und Timestamp aktualisieren
  const { error: updateError } = await supabase
    .from("bounty_referrals")
    .update({
      hire_proof_uploaded_at: new Date().toISOString(),
      status: "awaiting_claim",
    })
    .eq("id", referral.id);

  if (updateError) {
    return actionError("Status-Update fehlgeschlagen.");
  }

  try {
    await logAuditEvent({
      action: "referral.hire_proof_uploaded",
      targetId: referral.id,
      metadata: { bounty_id: referral.bounty_id },
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  revalidatePath("/referrals/mine");
  return actionOk("Nachweis hochgeladen. Der Inserent wird benachrichtigt.");
}

// ── Schritt 7: A bestätigt Claim ────────────────────────────────────────────

export async function confirmClaimAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser().catch(() => null);
  if (!user) return actionError("Bitte melde dich an.");

  const parsed = confirmClaimSchema.safeParse(toObj(formData));
  if (!parsed.success) return actionError("Ungültige Eingaben.");

  const supabase = await getSupabaseServerClient();

  // Ownership: nur der Bounty-Owner darf bestätigen
  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, bounty_id, status, bounties!bounty_referrals_bounty_id_fkey(owner_id)")
    .eq("id", parsed.data.referralId)
    .eq("status", "awaiting_claim")
    .maybeSingle();

  const bounty = Array.isArray(referral?.bounties) ? referral.bounties[0] : referral?.bounties;
  if (!referral || bounty?.owner_id !== user.id) {
    return actionError("Referral nicht gefunden oder nicht berechtigt.");
  }

  const { error } = await supabase
    .from("bounty_referrals")
    .update({
      claim_confirmed_at: new Date().toISOString(),
      claim_confirmed_by: user.id,
      status: "awaiting_payout_account",
    })
    .eq("id", referral.id);

  if (error) return actionError("Claim-Bestätigung fehlgeschlagen.");

  try {
    await logAuditEvent({
      action: "referral.claim_confirmed",
      targetId: referral.id,
      metadata: { bounty_id: referral.bounty_id },
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  return actionOk("Claim bestätigt.");
}

// ── Schritt 8: A bestätigt Payout-Account + Firmendaten ─────────────────────

export async function confirmPayoutAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser().catch(() => null);
  if (!user) return actionError("Bitte melde dich an.");

  const parsed = confirmPayoutAccountSchema.safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError("Bitte prüfe deine Eingaben.", fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();

  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, bounty_id, status, bounties!bounty_referrals_bounty_id_fkey(owner_id)")
    .eq("id", parsed.data.referralId)
    .eq("status", "awaiting_payout_account")
    .maybeSingle();

  const bounty = Array.isArray(referral?.bounties) ? referral.bounties[0] : referral?.bounties;
  if (!referral || bounty?.owner_id !== user.id) {
    return actionError("Referral nicht gefunden oder nicht berechtigt.");
  }

  const { error } = await supabase
    .from("bounty_referrals")
    .update({
      payout_account_confirmed_at: new Date().toISOString(),
      payout_account_confirmed_by: user.id,
      company_name: parsed.data.companyName,
      company_billing_email: parsed.data.companyEmail,
      company_billing_address: {
        line1: parsed.data.addressLine1,
        line2: parsed.data.addressLine2 ?? null,
        city: parsed.data.addressCity,
        postal_code: parsed.data.addressPostalCode,
        country: parsed.data.addressCountry,
      },
      company_tax_id: parsed.data.companyTaxId,
      status: "awaiting_data_forwarding",
    })
    .eq("id", referral.id);

  if (error) return actionError("Konto-Bestätigung fehlgeschlagen.");

  try {
    await logAuditEvent({
      action: "referral.payout_account_confirmed",
      targetId: referral.id,
      metadata: { bounty_id: referral.bounty_id, company: parsed.data.companyName },
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  return actionOk("Firmendaten gespeichert.");
}

// ── Schritt 9: A bestätigt Datenweitergabe → Payout-Trigger ─────────────────

export async function confirmDataForwardedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser().catch(() => null);
  if (!user) return actionError("Bitte melde dich an.");

  const parsed = confirmDataForwardedSchema.safeParse(toObj(formData));
  if (!parsed.success) return actionError("Ungültige Eingaben.");

  const supabase = await getSupabaseServerClient();

  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, bounty_id, status, bounties!bounty_referrals_bounty_id_fkey(owner_id)")
    .eq("id", parsed.data.referralId)
    .eq("status", "awaiting_data_forwarding")
    .maybeSingle();

  const bounty = Array.isArray(referral?.bounties) ? referral.bounties[0] : referral?.bounties;
  if (!referral || bounty?.owner_id !== user.id) {
    return actionError("Referral nicht gefunden oder nicht berechtigt.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("bounty_referrals")
    .update({
      data_forwarded_at: now,
      data_forwarded_by: user.id,
    })
    .eq("id", referral.id);

  if (error) return actionError("Datenweitergabe-Bestätigung fehlgeschlagen.");

  try {
    await logAuditEvent({
      action: "referral.data_forwarded",
      targetId: referral.id,
      metadata: { bounty_id: referral.bounty_id },
    });
  } catch { /* non-blocking */ }

  // Payout-Orchestrator triggern (idempotent)
  const payoutResult = await triggerSplitPayout(referral.id);

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  revalidatePath("/payouts");

  if (payoutResult.kind === "blocked") {
    return actionError(`Datenweitergabe gespeichert, aber Zahlung blockiert: ${payoutResult.reason}`);
  }
  if (payoutResult.kind === "already_processed") {
    return actionOk("Zahlung wurde bereits verarbeitet.");
  }

  return actionOk(
    payoutResult.kind === "invoice_created"
      ? `Rechnung erstellt und an die Firma gesendet. Zahlungslink: ${payoutResult.hostedUrl}`
      : "Datenweitergabe bestätigt.",
  );
}

// ── Ablehnung (Stufen 7, 8, 9) ──────────────────────────────────────────────

export async function rejectConfirmationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser().catch(() => null);
  if (!user) return actionError("Bitte melde dich an.");

  const parsed = rejectionSchema.safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError("Bitte prüfe deine Eingaben.", fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();

  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, bounty_id, status, bounties!bounty_referrals_bounty_id_fkey(owner_id)")
    .eq("id", parsed.data.referralId)
    .maybeSingle();

  const bounty = Array.isArray(referral?.bounties) ? referral.bounties[0] : referral?.bounties;
  if (!referral || bounty?.owner_id !== user.id) {
    return actionError("Referral nicht gefunden oder nicht berechtigt.");
  }

  const now = new Date().toISOString();
  const { error: rejError } = await supabase.from("referral_rejections").insert({
    referral_id: referral.id,
    stage: parsed.data.stage,
    reason: parsed.data.reason,
    rejected_by: user.id,
  });

  if (rejError) return actionError("Ablehnung konnte nicht gespeichert werden.");

  await supabase
    .from("bounty_referrals")
    .update({
      status: "rejected",
      rejection_reason: parsed.data.reason,
      rejection_stage: parsed.data.stage,
      rejection_at: now,
      rejection_by: user.id,
    })
    .eq("id", referral.id);

  try {
    await logAuditEvent({
      action: "referral.confirmation_rejected",
      targetId: referral.id,
      metadata: { stage: parsed.data.stage, bounty_id: referral.bounty_id },
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  revalidatePath("/referrals/mine");
  return actionOk("Ablehnung gespeichert.");
}

// ── B öffnet Dispute nach Ablehnung ─────────────────────────────────────────

export async function openDisputeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser().catch(() => null);
  if (!user) return actionError("Bitte melde dich an.");

  const parsed = disputeOpenSchema.safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError("Bitte prüfe deine Eingaben.", fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();

  // Nur Kandidat B darf Dispute öffnen, und nur bei abgelehntem Referral
  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, bounty_id, status, candidate_user_id, rejection_at")
    .eq("id", parsed.data.referralId)
    .eq("candidate_user_id", user.id)
    .eq("status", "rejected")
    .maybeSingle();

  if (!referral) {
    return actionError("Referral nicht gefunden oder Dispute nicht möglich.");
  }

  // 7-Tage-Fenster für Dispute
  const rejectedAt = referral.rejection_at ? new Date(referral.rejection_at) : null;
  if (rejectedAt && Date.now() - rejectedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return actionError("Das 7-Tage-Fenster für Dispute ist abgelaufen.");
  }

  const { error } = await supabase.from("referral_disputes").insert({
    referral_id: referral.id,
    opened_by: user.id,
    reason: parsed.data.reason,
    status: "open",
  });

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return actionError("Für dieses Referral wurde bereits ein Dispute eröffnet.");
    }
    return actionError("Dispute konnte nicht eröffnet werden.");
  }

  await supabase
    .from("bounty_referrals")
    .update({ status: "disputed" })
    .eq("id", referral.id);

  try {
    await logAuditEvent({
      action: "referral.dispute_opened",
      targetId: referral.id,
      metadata: { bounty_id: referral.bounty_id },
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  revalidatePath("/referrals/mine");
  return actionOk("Dispute eröffnet. Das Team wird sich innerhalb von 14 Tagen melden.");
}
