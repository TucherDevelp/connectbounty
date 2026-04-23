import { z } from "zod";

/**
 * Zod-Schemas für den Referral-Flow.
 * Spiegelt die DB-Constraints aus supabase/migrations/0003_marketplace.sql
 * (z. B. 2–120 Zeichen für candidate_name, E-Mail-Format, message ≤ 2000).
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

// Owner kann Status ändern – zulässige Ziel-Stati für die UI.
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

export type ReferralSubmitInput = z.infer<typeof referralSubmitSchema>;
export type ReferralStatusUpdateInput = z.infer<typeof referralStatusUpdateSchema>;
