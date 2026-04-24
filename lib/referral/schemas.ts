import { z } from "zod";

/**
 * Zod-Schemas für den Referral-Flow.
 * Spiegelt die DB-Constraints aus supabase/migrations/0003_marketplace.sql
 * (z. B. 2-120 Zeichen für candidate_name, E-Mail-Format, message ≤ 2000).
 */

const uuidSchema = z.string().uuid("Ungültige ID");

const candidateNameSchema = z
  .string({ message: "Kandidatenname ist erforderlich" })
  .trim()
  .min(2, "Name muss mindestens 2 Zeichen haben")
  .max(120, "Name darf höchstens 120 Zeichen haben");

const candidateEmailSchema = z
  .string({ message: "E-Mail ist erforderlich" })
  .trim()
  .max(254, "E-Mail ist zu lang")
  .email("Bitte gib eine gültige E-Mail-Adresse ein");

const candidateContactSchema = z
  .string()
  .trim()
  .max(500, "Kontaktdaten zu lang")
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const messageSchema = z
  .string()
  .trim()
  .max(2000, "Nachricht darf höchstens 2000 Zeichen haben")
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const referralSubmitSchema = z.object({
  bountyId: uuidSchema,
  candidateName: candidateNameSchema,
  candidateEmail: candidateEmailSchema,
  candidateContact: candidateContactSchema,
  message: messageSchema,
});

// Owner kann Status ändern - zulässige Ziel-Stati für die UI.
// Trigger enforce_referral_transition erzwingt die Übergangs-Matrix auf DB-Ebene.
export const referralStatusUpdateSchema = z.object({
  id: uuidSchema,
  status: z.enum([
    "contacted",
    "interviewing",
    "hired",
    "paid",
    "rejected",
  ]),
});

export const referralIdSchema = z.object({ id: uuidSchema });

// ── v7: Three-stage confirmation schemas ─────────────────────────────────

/** B wählt ein Inserat und legt das Referral mit Status=awaiting_hire_proof an */
export const claimHireSchema = z.object({
  bountyId: uuidSchema,
  /** Kurze Notiz von B (optional) */
  note: z.string().trim().max(500).optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

/** B lädt Hire-Proof hoch (Datei-Metadaten - Upload selbst via Storage-API) */
export const hireProofUploadSchema = z.object({
  referralId: uuidSchema,
  storagePath: z.string().min(1, "Storage-Pfad ist erforderlich"),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  fileSize: z.coerce.number().int().positive().max(10_485_760, "Datei zu groß (max 10 MB)"),
});

/** A bestätigt Claim */
export const confirmClaimSchema = z.object({
  referralId: uuidSchema,
});

/** A bestätigt Plattform-Stripe-Konto + Firmendaten */
export const confirmPayoutAccountSchema = z.object({
  referralId: uuidSchema,
  companyName: z.string().trim().min(2).max(200),
  companyEmail: z.string().trim().email("Bitte eine gültige E-Mail angeben"),
  addressLine1: z.string().trim().min(2).max(200),
  addressLine2: z.string().trim().max(200).optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  addressCity: z.string().trim().min(2).max(100),
  addressPostalCode: z.string().trim().min(2).max(20),
  addressCountry: z.string().trim().length(2, "Zweistelliger ISO-Ländercode erforderlich").toUpperCase(),
  companyTaxId: z.string().trim().max(30).optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

/** A bestätigt Datenweitergabe an die Firma */
export const confirmDataForwardedSchema = z.object({
  referralId: uuidSchema,
});

/** A oder B lehnt eine Stufe ab - Begründung mindestens 50 Zeichen */
export const rejectionSchema = z.object({
  referralId: uuidSchema,
  stage: z.enum(["hire_proof", "claim", "payout_account", "data_forwarding"]),
  reason: z.string().trim()
    .min(50, "Begründung muss mindestens 50 Zeichen haben")
    .max(2000, "Begründung darf maximal 2000 Zeichen haben"),
});

/** B öffnet Dispute nach Ablehnung */
export const disputeOpenSchema = z.object({
  referralId: uuidSchema,
  reason: z.string().trim()
    .min(50, "Begründung muss mindestens 50 Zeichen haben")
    .max(2000),
});

export type ReferralSubmitInput = z.infer<typeof referralSubmitSchema>;
export type ReferralStatusUpdateInput = z.infer<typeof referralStatusUpdateSchema>;
export type ClaimHireInput = z.infer<typeof claimHireSchema>;
export type HireProofUploadInput = z.infer<typeof hireProofUploadSchema>;
export type ConfirmPayoutAccountInput = z.infer<typeof confirmPayoutAccountSchema>;
export type RejectionInput = z.infer<typeof rejectionSchema>;
export type DisputeOpenInput = z.infer<typeof disputeOpenSchema>;
