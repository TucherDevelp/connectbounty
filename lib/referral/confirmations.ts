"use server";

import "server-only";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser, logAuditEvent } from "@/lib/auth/roles";
import { t } from "@/lib/i18n";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import {
  actionError,
  actionOk,
  fieldErrorsFromZod,
  type ActionState,
} from "@/lib/auth/action-result";
import {
  createClaimHireSchema,
  createHireProofUploadSchema,
  createConfirmClaimSchema,
  createConfirmPayoutAccountSchema,
  createConfirmDataForwardedSchema,
  createRejectionSchema,
  createDisputeOpenSchema,
  createApplicationFlagSchema,
  createRejectionDocumentSchema,
} from "./schemas";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { triggerSplitPayout } from "@/lib/stripe/payout-orchestrator";

function toObj(fd: FormData): Record<string, FormDataEntryValue> {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

async function actionLang() {
  return parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
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
  const lang = await actionLang();
  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "bounty_action_login"));

  const parsed = createClaimHireSchema(lang).safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError(t(lang, "ref_action_invalid_input"), fieldErrorsFromZod(parsed.error.issues));
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
    return actionError(t(lang, "ref_action_bounty_gone"));
  }
  if (bounty.owner_id === user.id) {
    return actionError(t(lang, "ref_action_own_bounty"));
  }

  // Bereits ein Referral für diesen User + Bounty?
  const { data: existing } = await supabase
    .from("bounty_referrals")
    .select("id, status")
    .eq("bounty_id", parsed.data.bountyId)
    .eq("candidate_user_id", user.id)
    .maybeSingle();

  if (existing) {
    return actionOk(
      t(lang, "ref_action_existing_referral").replace("{status}", existing.status),
    );
  }

  const { data, error } = await supabase
    .from("bounty_referrals")
    .insert({
      bounty_id: parsed.data.bountyId,
      // TODO: claimHireAction ist ein Direktbewerbungs-Flow ohne echten Referrer.
      // In diesem Fall ist referrer_id konzeptionell falsch — es gibt keinen Referrer.
      // Korrekte Lösung: referrer_id nullable machen (Migration erforderlich) oder
      // diesen Flow nur über einen echten Referrer erlauben.
      // Vorerst: kandidat selbst als Platzhalter (wird durch RLS-Check benötigt).
      referrer_id: user.id,
      candidate_user_id: user.id,
      candidate_name: user.email ?? "Unbekannt",
      candidate_email: user.email ?? "",
      message: parsed.data.note,
      status: "awaiting_hire_proof",
    })
    .select("id")
    .single();

  if (error || !data) {
    return actionError(t(lang, "ref_action_referral_create_failed"));
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
  const lang = await actionLang();
  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "bounty_action_login"));

  const parsed = createHireProofUploadSchema(lang).safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError(t(lang, "ref_action_invalid_input"), fieldErrorsFromZod(parsed.error.issues));
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
    return actionError(t(lang, "ref_action_referral_forbidden"));
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
    return actionError(t(lang, "ref_action_doc_save_failed"));
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
    return actionError(t(lang, "ref_action_status_update_failed"));
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
  return actionOk("");
}

// ── Schritt 7: A bestätigt Claim ────────────────────────────────────────────

export async function confirmClaimAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = await actionLang();
  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "bounty_action_login"));

  const parsed = createConfirmClaimSchema(lang).safeParse(toObj(formData));
  if (!parsed.success) return actionError(t(lang, "ref_action_invalid_input"));

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
    return actionError(t(lang, "ref_action_not_owner"));
  }

  const { error } = await supabase
    .from("bounty_referrals")
    .update({
      claim_confirmed_at: new Date().toISOString(),
      claim_confirmed_by: user.id,
      status: "awaiting_payout_account",
    })
    .eq("id", referral.id);

  if (error) return actionError(t(lang, "ref_action_claim_failed"));

  try {
    await logAuditEvent({
      action: "referral.claim_confirmed",
      targetId: referral.id,
      metadata: { bounty_id: referral.bounty_id },
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  return actionOk("");
}

// ── Schritt 8: A bestätigt Payout-Account + Firmendaten ─────────────────────

export async function confirmPayoutAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = await actionLang();
  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "bounty_action_login"));

  const parsed = createConfirmPayoutAccountSchema(lang).safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError(t(lang, "bounty_action_check_input"), fieldErrorsFromZod(parsed.error.issues));
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
    return actionError(t(lang, "ref_action_not_owner"));
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

  if (error) return actionError(t(lang, "ref_action_payout_failed"));

  try {
    await logAuditEvent({
      action: "referral.payout_account_confirmed",
      targetId: referral.id,
      metadata: { bounty_id: referral.bounty_id, company: parsed.data.companyName },
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  return actionOk("");
}

// ── Schritt 9: A bestätigt Datenweitergabe → Payout-Trigger ─────────────────

export async function confirmDataForwardedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = await actionLang();
  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "bounty_action_login"));

  const parsed = createConfirmDataForwardedSchema(lang).safeParse(toObj(formData));
  if (!parsed.success) return actionError(t(lang, "ref_action_invalid_input"));

  const supabase = await getSupabaseServerClient();

  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, bounty_id, status, bounties!bounty_referrals_bounty_id_fkey(owner_id)")
    .eq("id", parsed.data.referralId)
    .eq("status", "awaiting_data_forwarding")
    .maybeSingle();

  const bounty = Array.isArray(referral?.bounties) ? referral.bounties[0] : referral?.bounties;
  if (!referral || bounty?.owner_id !== user.id) {
    return actionError(t(lang, "ref_action_not_owner"));
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("bounty_referrals")
    .update({
      data_forwarded_at: now,
      data_forwarded_by: user.id,
    })
    .eq("id", referral.id);

  if (error) return actionError(t(lang, "ref_action_forward_failed"));

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
    return actionError(
      t(lang, "ref_action_payment_blocked").replace("{reason}", payoutResult.reason),
    );
  }
  if (payoutResult.kind === "already_processed") {
    return actionOk(t(lang, "ref_action_payment_already"));
  }

  return actionOk(
    payoutResult.kind === "invoice_created"
      ? t(lang, "ref_action_invoice_created").replace("{url}", payoutResult.hostedUrl)
      : t(lang, "ref_action_data_forwarded_ok"),
  );
}

// ── Ablehnung (Stufen 7, 8, 9) ──────────────────────────────────────────────

export async function rejectConfirmationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = await actionLang();
  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "bounty_action_login"));

  const parsed = createRejectionSchema(lang).safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError(t(lang, "bounty_action_check_input"), fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();

  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, bounty_id, status, bounties!bounty_referrals_bounty_id_fkey(owner_id)")
    .eq("id", parsed.data.referralId)
    .maybeSingle();

  const bounty = Array.isArray(referral?.bounties) ? referral.bounties[0] : referral?.bounties;
  if (!referral || bounty?.owner_id !== user.id) {
    return actionError(t(lang, "ref_action_not_owner"));
  }

  const now = new Date().toISOString();
  const { error: rejError } = await supabase.from("referral_rejections").insert({
    referral_id: referral.id,
    stage: parsed.data.stage,
    reason: parsed.data.reason,
    rejected_by: user.id,
  });

  if (rejError) return actionError(t(lang, "ref_action_reject_failed"));

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
  return actionOk("");
}

// ── B öffnet Dispute nach Ablehnung ─────────────────────────────────────────

export async function openDisputeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = await actionLang();
  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "bounty_action_login"));

  const parsed = createDisputeOpenSchema(lang).safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError(t(lang, "bounty_action_check_input"), fieldErrorsFromZod(parsed.error.issues));
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
    return actionError(t(lang, "ref_action_dispute_forbidden"));
  }

  // 7-Tage-Fenster für Dispute
  const rejectedAt = referral.rejection_at ? new Date(referral.rejection_at) : null;
  if (rejectedAt && Date.now() - rejectedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return actionError(t(lang, "ref_action_dispute_expired"));
  }

  const { error } = await supabase.from("referral_disputes").insert({
    referral_id: referral.id,
    opened_by: user.id,
    reason: parsed.data.reason,
    status: "open",
  });

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return actionError(t(lang, "ref_action_dispute_duplicate"));
    }
    return actionError(t(lang, "ref_action_dispute_failed"));
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
  return actionOk(t(lang, "ref_action_dispute_ok"));
}

// ── Kandidat flaggt „Bewerbung eingereicht" → Kontaktfreigabe ──────────────
//
// Konzept (docs/KONZEPTPLATTFORM-GESCHAEFTSMODELL.md, Abschnitt 4, Schritt 3):
// Bis zu diesem Zeitpunkt ist die Kommunikation anonym. Das Setzen des Flags
// markiert den Übergang in die operative Phase und gibt die Kontaktdaten an
// den Inserenten frei. Beides geschieht atomar in einem Update.

export async function flagApplicationSubmittedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = await actionLang();
  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "bounty_action_login"));

  const parsed = createApplicationFlagSchema(lang).safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError(t(lang, "ref_action_invalid_input"), fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();

  // Nur der Kandidat selbst darf flaggen, und nur solange noch nicht geflaggt.
  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, bounty_id, status, candidate_user_id, application_submitted_at")
    .eq("id", parsed.data.referralId)
    .eq("candidate_user_id", user.id)
    .maybeSingle();

  if (!referral) {
    return actionError(t(lang, "ref_action_application_forbidden"));
  }
  if (referral.application_submitted_at) {
    // Idempotent: bereits geflaggt → kein Fehler, kein erneutes Audit
    revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
    revalidatePath("/referrals/mine");
    return actionOk(t(lang, "ref_action_application_already"));
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("bounty_referrals")
    .update({
      application_submitted_at: now,
      application_submitted_by: user.id,
      contact_released_at: now,
      contact_released_by: user.id,
    })
    .eq("id", referral.id);

  if (error) {
    return actionError(t(lang, "ref_action_application_failed"));
  }

  try {
    await logAuditEvent({
      action: "referral.application_flagged",
      targetId: referral.id,
      metadata: { bounty_id: referral.bounty_id },
    });
    await logAuditEvent({
      action: "referral.contact_released",
      targetId: referral.id,
      metadata: { bounty_id: referral.bounty_id, trigger: "application_flag" },
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  revalidatePath("/referrals/mine");
  return actionOk(t(lang, "ref_action_application_ok"));
}

// ── Inserent: offizielles Ablehnungsschreiben hochladen + Status setzen ──
//
// Konzept (docs/KONZEPTPLATTFORM-GESCHAEFTSMODELL.md, Abschnitt 4, Schritt 4):
// Nach Kontaktfreigabe muss der Inserent ein offizielles Ablehnungsschreiben
// hochladen, falls er den Vorgang stoppen will. Ohne Dokument bleibt der
// Vorgang aktiv. Die UI vorab lädt die Datei via signed-upload in den
// Bucket 'rejection-documents' und übergibt hier die Metadaten + Begründung.

export async function rejectWithDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = await actionLang();
  const user = await requireUser().catch(() => null);
  if (!user) return actionError(t(lang, "bounty_action_login"));

  const parsed = createRejectionDocumentSchema(lang).safeParse(toObj(formData));
  if (!parsed.success) {
    return actionError(t(lang, "bounty_action_check_input"), fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();

  // Nur der Bounty-Owner darf ablehnen, und nur nach Kontaktfreigabe.
  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select(
      "id, bounty_id, status, contact_released_at, bounties!bounty_referrals_bounty_id_fkey(owner_id)",
    )
    .eq("id", parsed.data.referralId)
    .maybeSingle();

  const bounty = Array.isArray(referral?.bounties) ? referral.bounties[0] : referral?.bounties;
  if (!referral || bounty?.owner_id !== user.id) {
    return actionError(t(lang, "ref_action_not_owner"));
  }
  if (!referral.contact_released_at) {
    return actionError(t(lang, "ref_action_rejection_doc_premature"));
  }
  if (referral.status === "rejected") {
    return actionError(t(lang, "ref_action_rejection_doc_already"));
  }

  // Pfad-Konvention: {referral_id}/{...} - durchgesetzt von Storage-RLS.
  if (!parsed.data.storagePath.startsWith(`${referral.id}/`)) {
    return actionError(t(lang, "ref_action_rejection_doc_path_invalid"));
  }

  const sb = getSupabaseServiceRoleClient();

  // Dokument-Metadaten persistieren (append-only).
  const { error: insertErr } = await sb.from("rejection_documents").insert({
    referral_id: referral.id,
    uploaded_by: user.id,
    storage_path: parsed.data.storagePath,
    original_name: parsed.data.originalName,
    mime_type: parsed.data.mimeType,
    file_size: parsed.data.fileSize,
  });
  if (insertErr) {
    return actionError(t(lang, "ref_action_rejection_doc_save_failed"));
  }

  // Stage aus aktuellem Status ableiten - bei Bedarf 'data_forwarding' als
  // Default, da nach Kontaktfreigabe der Vorgang in der operativen Phase ist.
  const stage = inferRejectionStage(referral.status as string);
  const now = new Date().toISOString();

  const { error: updateErr } = await sb
    .from("bounty_referrals")
    .update({
      status: "rejected",
      rejection_reason: parsed.data.reason,
      rejection_stage: stage,
      rejection_at: now,
      rejection_by: user.id,
    })
    .eq("id", referral.id);

  if (updateErr) {
    return actionError(t(lang, "ref_action_reject_failed"));
  }

  // Append-only Audit-Trail.
  await sb.from("referral_rejections").insert({
    referral_id: referral.id,
    stage,
    reason: parsed.data.reason,
    rejected_by: user.id,
  });

  try {
    await logAuditEvent({
      action: "referral.rejection_uploaded",
      targetId: referral.id,
      metadata: {
        bounty_id: referral.bounty_id,
        storage_path: parsed.data.storagePath,
        stage,
      },
    });
    await logAuditEvent({
      action: "referral.confirmation_rejected",
      targetId: referral.id,
      metadata: { stage, bounty_id: referral.bounty_id, with_document: "true" },
    });
  } catch { /* non-blocking */ }

  revalidatePath(`/bounties/${referral.bounty_id}/referrals/${referral.id}`);
  revalidatePath("/referrals/mine");
  return actionOk(t(lang, "ref_action_rejection_doc_ok"));
}

function inferRejectionStage(
  status: string,
): "hire_proof" | "claim" | "payout_account" | "data_forwarding" {
  switch (status) {
    case "awaiting_hire_proof":
      return "hire_proof";
    case "awaiting_claim":
      return "claim";
    case "awaiting_payout_account":
      return "payout_account";
    case "awaiting_data_forwarding":
    default:
      return "data_forwarding";
  }
}
