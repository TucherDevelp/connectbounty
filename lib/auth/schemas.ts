import { z } from "zod";

/**
 * Zentrale Validation-Schemas für alle Auth-Flows.
 *
 * Designprinzipien:
 *   • Alle Fehlertexte auf Deutsch (Zielsprache der Plattform).
 *   • E-Mail bewusst nur bis 254 Zeichen (RFC 5321).
 *   • Passwort: 12+ Zeichen, mindestens 3 von 4 Zeichenklassen
 *     (Großbuchstaben, Kleinbuchstaben, Ziffern, Sonderzeichen).
 *     Härter als das Supabase-Default-Minimum, an OWASP ASVS L2 angelehnt.
 */

const emailSchema = z
  .string({ message: "E-Mail ist erforderlich" })
  .trim()
  .min(1, "E-Mail ist erforderlich")
  .max(254, "E-Mail ist zu lang")
  .email("Bitte gib eine gültige E-Mail-Adresse ein");

const passwordSchema = z
  .string({ message: "Passwort ist erforderlich" })
  .min(12, "Passwort muss mindestens 12 Zeichen lang sein")
  .max(128, "Passwort ist zu lang")
  .superRefine((val, ctx) => {
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) => re.test(val)).length;
    if (classes < 3) {
      ctx.addIssue({
        code: "custom",
        message:
          "Verwende mindestens 3 von: Klein-/Großbuchstaben, Ziffern, Sonderzeichen",
      });
    }
  });

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Name muss mindestens 2 Zeichen haben")
  .max(64, "Name darf höchstens 64 Zeichen haben");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Passwort ist erforderlich"),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    displayName: displayNameSchema,
    terms: z
      .union([z.literal("on"), z.literal("true"), z.boolean()])
      .refine((v) => v === true || v === "on" || v === "true", {
        message: "Bitte akzeptiere die Nutzungsbedingungen",
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwörter stimmen nicht überein",
  });

export const requestResetSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwörter stimmen nicht überein",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RequestResetInput = z.infer<typeof requestResetSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
