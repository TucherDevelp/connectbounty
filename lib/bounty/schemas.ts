import { z } from "zod";

/**
 * Zod-Schemas für Bounty-Create/Update.
 *
 * Designprinzipien:
 *   • Serverseitige Validierung spiegelt die DB-Constraints aus
 *     supabase/migrations/0003_marketplace.sql. Beide Schichten sind
 *     bewusst redundant - Browser-Manipulation darf nicht zum Ziel führen.
 *   • Zahlen kommen über FormData als string - wir coercen explizit.
 *   • Tags sind Comma-Separated in der UI; Parser + Deduplikation hier.
 *   • Fehlermeldungen auf Deutsch (Plattform-Sprache).
 */

const titleSchema = z
  .string({ message: "Titel ist erforderlich" })
  .trim()
  .min(5, "Titel muss mindestens 5 Zeichen haben")
  .max(120, "Titel darf höchstens 120 Zeichen haben");

const descriptionSchema = z
  .string({ message: "Beschreibung ist erforderlich" })
  .trim()
  .min(20, "Beschreibung muss mindestens 20 Zeichen haben")
  .max(5000, "Beschreibung darf höchstens 5000 Zeichen haben");

// FormData liefert string - coerce.number() wäre zu lasch (akzeptiert "").
// Wir parsen explizit und werfen präzise Fehler.
const bonusAmountSchema = z
  .union([z.number(), z.string()])
  .transform((val, ctx) => {
    if (typeof val === "number") return val;
    const trimmed = val.trim().replace(",", ".");
    if (trimmed === "") {
      ctx.addIssue({ code: "custom", message: "Prämie ist erforderlich" });
      return z.NEVER;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: "Prämie muss eine Zahl sein" });
      return z.NEVER;
    }
    return n;
  })
  .pipe(
    z
      .number()
      .positive("Prämie muss größer als 0 sein")
      .max(1_000_000, "Prämie darf höchstens 1.000.000 sein")
      .refine((n) => Math.round(n * 100) / 100 === n, {
        message: "Maximal 2 Nachkommastellen",
      }),
  );

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Ungültiger ISO-Währungscode (z. B. EUR)")
  .default("EUR");

const locationSchema = z
  .string()
  .trim()
  .max(120, "Ort darf höchstens 120 Zeichen haben")
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const industrySchema = z
  .string()
  .trim()
  .max(80, "Branche darf höchstens 80 Zeichen haben")
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const tagsSchema = z
  .union([z.string(), z.array(z.string()).optional()])
  .transform((val, ctx) => {
    const raw = Array.isArray(val) ? val : typeof val === "string" ? val.split(",") : [];
    const cleaned = Array.from(
      new Set(
        raw
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.length > 0),
      ),
    );
    if (cleaned.length > 10) {
      ctx.addIssue({ code: "custom", message: "Maximal 10 Tags" });
      return z.NEVER;
    }
    for (const tag of cleaned) {
      if (tag.length > 32) {
        ctx.addIssue({ code: "custom", message: `Tag "${tag}" ist zu lang (max 32 Zeichen)` });
        return z.NEVER;
      }
      if (!/^[a-z0-9][a-z0-9\-._]*$/.test(tag)) {
        ctx.addIssue({
          code: "custom",
          message: `Tag "${tag}" enthält unerlaubte Zeichen`,
        });
        return z.NEVER;
      }
    }
    return cleaned;
  });

// Datum in ISO 8601 (YYYY-MM-DDTHH:mm oder YYYY-MM-DD). Muss in der Zukunft liegen.
const expiresAtSchema = z
  .union([z.string(), z.date()])
  .optional()
  .transform((val, ctx) => {
    if (val === undefined || val === "" || val === null) return null;
    const date = val instanceof Date ? val : new Date(val);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Ungültiges Datum" });
      return z.NEVER;
    }
    if (date.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", message: "Ablaufdatum muss in der Zukunft liegen" });
      return z.NEVER;
    }
    return date.toISOString();
  });

// ── Split-Konfiguration (BPS = Basis-Punkte, 10 000 = 100 %) ─────────────

const bpsSchema = z
  .union([z.number(), z.string()])
  .transform((val, ctx) => {
    const n = typeof val === "number" ? val : Number(String(val).trim());
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 10_000) {
      ctx.addIssue({ code: "custom", message: "BPS-Wert muss eine ganze Zahl zwischen 0 und 10 000 sein" });
      return z.NEVER;
    }
    return n;
  });

const splitReferrerBpsSchema = bpsSchema.default(4000);
const splitCandidateBpsSchema = bpsSchema.default(4000);
const splitPlatformBpsSchema = bpsSchema.default(2000);

const paymentModeSchema = z
  .enum(["on_confirmation", "escrow"])
  .default("on_confirmation");

// Basis-Objekt ohne Refinements (damit .partial() darauf anwendbar ist)
const bountyBaseSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  bonusAmount: bonusAmountSchema,
  bonusCurrency: currencySchema,
  location: locationSchema,
  industry: industrySchema,
  tags: tagsSchema,
  expiresAt: expiresAtSchema,
  splitReferrerBps: splitReferrerBpsSchema,
  splitCandidateBps: splitCandidateBpsSchema,
  splitPlatformBps: splitPlatformBpsSchema,
  paymentMode: paymentModeSchema,
});

// Refinements nur für Create (Summe + Mindest-Plattform-Anteil)
export const bountyCreateSchema = bountyBaseSchema
  .refine(
    (d) => d.splitReferrerBps + d.splitCandidateBps + d.splitPlatformBps === 10_000,
    { message: "Die drei Split-Werte müssen zusammen 10 000 BPS (= 100 %) ergeben." },
  )
  .refine(
    (d) => d.splitPlatformBps >= 500,
    { message: "Der Plattform-Anteil muss mindestens 500 BPS (= 5 %) betragen." },
  );

// Update: partial auf dem Basis-Schema (ohne Refinements, die partial verbieten)
export const bountyUpdateSchema = bountyBaseSchema.partial();

export const bountyIdSchema = z.object({
  id: z.string().uuid("Ungültige Bounty-ID"),
});

export type BountyCreateInput = z.infer<typeof bountyCreateSchema>;
export type BountyUpdateInput = z.infer<typeof bountyUpdateSchema>;
