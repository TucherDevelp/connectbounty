import { z } from "zod";
import { t, type Lang } from "@/lib/i18n";

/**
 * Zod-Schemas für den Referral-Flow.
 * Spiegelt die DB-Constraints aus supabase/migrations/0003_marketplace.sql
 * (z. B. 2-120 Zeichen für candidate_name, E-Mail-Format, message ≤ 2000).
 */

/** Legacy UUID (deutsch) für Status-Update / Withdraw – ohne Lang-Cookie */
const uuidSchemaLegacy = z.string().uuid("Ungültige ID");

function uuidField(lang: Lang) {
  return z.string().uuid(t(lang, "ref_zod_uuid"));
}

export function createReferralSubmitSchema(lang: Lang) {
  return z.object({
    bountyId: uuidField(lang),
    candidateName: z
      .string({ message: t(lang, "ref_zod_cand_name_required") })
      .trim()
      .min(2, t(lang, "ref_zod_cand_name_min"))
      .max(120, t(lang, "ref_zod_cand_name_max")),
    candidateEmail: z
      .string({ message: t(lang, "ref_zod_cand_email_required") })
      .trim()
      .max(254, t(lang, "ref_zod_cand_email_max"))
      .email(t(lang, "ref_zod_cand_email_invalid")),
    candidateContact: z
      .string()
      .trim()
      .max(500, t(lang, "ref_zod_cand_contact_max"))
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    message: z
      .string()
      .trim()
      .max(2000, t(lang, "ref_zod_message_max"))
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  });
}

export const referralSubmitSchema = createReferralSubmitSchema("de");

// Owner kann Status ändern - zulässige Ziel-Stati für die UI.
// Trigger enforce_referral_transition erzwingt die Übergangs-Matrix auf DB-Ebene.
export const referralStatusUpdateSchema = z.object({
  id: uuidSchemaLegacy,
  status: z.enum([
    "contacted",
    "interviewing",
    "hired",
    "paid",
    "rejected",
  ]),
});

export const referralIdSchema = z.object({ id: uuidSchemaLegacy });

// ── v7: Three-stage confirmation schemas ─────────────────────────────────

/** B wählt ein Inserat und legt das Referral mit Status=awaiting_hire_proof an */
export function createClaimHireSchema(lang: Lang) {
  return z.object({
    bountyId: uuidField(lang),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  });
}
export const claimHireSchema = createClaimHireSchema("de");

/** B lädt Hire-Proof hoch (Datei-Metadaten - Upload selbst via Storage-API) */
export function createHireProofUploadSchema(lang: Lang) {
  return z.object({
    referralId: uuidField(lang),
    storagePath: z.string().min(1, t(lang, "ref_zod_storage_path")),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
    fileSize: z.coerce
      .number()
      .int()
      .positive()
      .max(10_485_760, t(lang, "ref_zod_file_max")),
  });
}
export const hireProofUploadSchema = createHireProofUploadSchema("de");

/** A bestätigt Claim */
export function createConfirmClaimSchema(lang: Lang) {
  return z.object({ referralId: uuidField(lang) });
}
export const confirmClaimSchema = createConfirmClaimSchema("de");

/** A bestätigt Plattform-Stripe-Konto + Firmendaten */
export function createConfirmPayoutAccountSchema(lang: Lang) {
  return z.object({
    referralId: uuidField(lang),
    companyName: z
      .string()
      .trim()
      .min(2, t(lang, "ref_zod_company_min"))
      .max(200, t(lang, "ref_zod_company_max")),
    companyEmail: z.string().trim().email(t(lang, "ref_zod_email")),
    addressLine1: z
      .string()
      .trim()
      .min(2, t(lang, "ref_zod_addr_min"))
      .max(200, t(lang, "ref_zod_addr_max")),
    addressLine2: z
      .string()
      .trim()
      .max(200, t(lang, "ref_zod_addr2_max"))
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    addressCity: z
      .string()
      .trim()
      .min(2, t(lang, "ref_zod_city_min"))
      .max(100, t(lang, "ref_zod_city_max")),
    addressPostalCode: z
      .string()
      .trim()
      .min(2, t(lang, "ref_zod_postal_min"))
      .max(20, t(lang, "ref_zod_postal_max")),
    addressCountry: z
      .string()
      .trim()
      .length(2, t(lang, "ref_zod_country_iso"))
      .toUpperCase(),
    companyTaxId: z
      .string()
      .trim()
      .max(30, t(lang, "ref_zod_tax_max"))
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  });
}
export const confirmPayoutAccountSchema = createConfirmPayoutAccountSchema("de");

/** A bestätigt Datenweitergabe an die Firma */
export function createConfirmDataForwardedSchema(lang: Lang) {
  return z.object({ referralId: uuidField(lang) });
}
export const confirmDataForwardedSchema = createConfirmDataForwardedSchema("de");

/** A oder B lehnt eine Stufe ab - Begründung mindestens 50 Zeichen */
export function createRejectionSchema(lang: Lang) {
  return z.object({
    referralId: uuidField(lang),
    stage: z.enum(["hire_proof", "claim", "payout_account", "data_forwarding"]),
    reason: z
      .string()
      .trim()
      .min(50, t(lang, "ref_zod_reason_min"))
      .max(2000, t(lang, "ref_zod_reason_max")),
  });
}
export const rejectionSchema = createRejectionSchema("de");

/** B öffnet Dispute nach Ablehnung */
export function createDisputeOpenSchema(lang: Lang) {
  return z.object({
    referralId: uuidField(lang),
    reason: z
      .string()
      .trim()
      .min(50, t(lang, "ref_zod_reason_min"))
      .max(2000, t(lang, "ref_zod_reason_max")),
  });
}
export const disputeOpenSchema = createDisputeOpenSchema("de");

/**
 * Kandidat flaggt „Bewerbung wird/wurde abgeschickt" - löst Übergang von der
 * anonymen in die operative Phase aus (Kontaktdaten werden freigegeben).
 * Konzeptbezug: Abschnitt 4, Tracking-Schritt 3.
 */
export function createApplicationFlagSchema(lang: Lang) {
  return z.object({
    referralId: uuidField(lang),
  });
}
export const applicationFlagSchema = createApplicationFlagSchema("de");

/**
 * Inserent lädt offizielles Ablehnungsschreiben hoch und beendet damit den
 * Vorgang formal. Konzeptbezug: Abschnitt 4, Tracking-Schritt 4.
 *
 * Datei wird vorab via signed-upload in den Bucket 'rejection-documents'
 * geladen; diese Action verarbeitet die Metadaten + setzt den Status.
 */
export function createRejectionDocumentSchema(lang: Lang) {
  return z.object({
    referralId: uuidField(lang),
    storagePath: z.string().min(1, t(lang, "ref_zod_storage_path")),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
    fileSize: z.coerce
      .number()
      .int()
      .positive()
      .max(10_485_760, t(lang, "ref_zod_file_max")),
    originalName: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    reason: z
      .string()
      .trim()
      .min(50, t(lang, "ref_zod_reason_min"))
      .max(2000, t(lang, "ref_zod_reason_max")),
  });
}
export const rejectionDocumentSchema = createRejectionDocumentSchema("de");

export type ReferralSubmitInput = z.infer<typeof referralSubmitSchema>;
export type ReferralStatusUpdateInput = z.infer<typeof referralStatusUpdateSchema>;
export type ClaimHireInput = z.infer<typeof claimHireSchema>;
export type HireProofUploadInput = z.infer<typeof hireProofUploadSchema>;
export type ConfirmPayoutAccountInput = z.infer<typeof confirmPayoutAccountSchema>;
export type RejectionInput = z.infer<typeof rejectionSchema>;
export type DisputeOpenInput = z.infer<typeof disputeOpenSchema>;
