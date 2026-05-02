import { z } from "zod";
import { t, type Lang } from "@/lib/i18n";

/**
 * Zod-Schemas für Bounty-Create/Update.
 *
 * Designprinzipien:
 *   • Serverseitige Validierung spiegelt die DB-Constraints aus
 *     supabase/migrations/0003_marketplace.sql. Beide Schichten sind
 *     bewusst redundant - Browser-Manipulation darf nicht zum Ziel führen.
 *   • Zahlen kommen über FormData als string - wir coercen explizit.
 *   • Tags sind Comma-Separated in der UI; Parser + Deduplikation hier.
 *   • Fehlermeldungen über i18n (Lang aus Cookie / Server).
 */

function buildBountyBaseSchema(lang: Lang) {
  const titleSchema = z
    .string({ message: t(lang, "bounty_zod_title_required") })
    .trim()
    .min(5, t(lang, "bounty_zod_title_min"))
    .max(120, t(lang, "bounty_zod_title_max"));

  const descriptionSchema = z
    .string({ message: t(lang, "bounty_zod_desc_required") })
    .trim()
    .min(20, t(lang, "bounty_zod_desc_min"))
    .max(5000, t(lang, "bounty_zod_desc_max"));

  const bonusAmountSchema = z
    .union([z.number(), z.string()])
    .transform((val, ctx) => {
      if (typeof val === "number") return val;
      const trimmed = val.trim().replace(",", ".");
      if (trimmed === "") {
        ctx.addIssue({ code: "custom", message: t(lang, "bounty_zod_bonus_required") });
        return z.NEVER;
      }
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: t(lang, "bounty_zod_bonus_number") });
        return z.NEVER;
      }
      return n;
    })
    .pipe(
      z
        .number()
        .positive(t(lang, "bounty_zod_bonus_positive"))
        .max(1_000_000, t(lang, "bounty_zod_bonus_max"))
        .refine((n) => Math.round(n * 100) / 100 === n, {
          message: t(lang, "bounty_zod_bonus_decimals"),
        }),
    );

  const currencySchema = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, t(lang, "bounty_zod_currency_invalid"))
    .default("EUR");

  const locationSchema = z
    .string()
    .trim()
    .max(120, t(lang, "bounty_zod_location_max"))
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));

  const industrySchema = z
    .string()
    .trim()
    .max(80, t(lang, "bounty_zod_industry_max"))
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
        ctx.addIssue({ code: "custom", message: t(lang, "bounty_zod_tags_max") });
        return z.NEVER;
      }
      for (const tag of cleaned) {
        if (tag.length > 32) {
          ctx.addIssue({
            code: "custom",
            message: t(lang, "bounty_zod_tag_len").replace(/\{tag\}/g, tag),
          });
          return z.NEVER;
        }
        if (!/^[a-z0-9][a-z0-9\-._]*$/.test(tag)) {
          ctx.addIssue({
            code: "custom",
            message: t(lang, "bounty_zod_tag_chars").replace(/\{tag\}/g, tag),
          });
          return z.NEVER;
        }
      }
      return cleaned;
    });

  const expiresAtSchema = z
    .union([z.string(), z.date()])
    .optional()
    .transform((val, ctx) => {
      if (val === undefined || val === "" || val === null) return null;
      const date = val instanceof Date ? val : new Date(val);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: t(lang, "bounty_zod_expires_invalid") });
        return z.NEVER;
      }
      if (date.getTime() <= Date.now()) {
        ctx.addIssue({ code: "custom", message: t(lang, "bounty_zod_expires_future") });
        return z.NEVER;
      }
      return date.toISOString();
    });

  const bpsSchema = z.union([z.number(), z.string()]).transform((val, ctx) => {
    const n = typeof val === "number" ? val : Number(String(val).trim());
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 10_000) {
      ctx.addIssue({ code: "custom", message: t(lang, "bounty_zod_bps_range") });
      return z.NEVER;
    }
    return n;
  });

  const splitInserentBpsSchema = bpsSchema.default(4000);
  const splitCandidateBpsSchema = bpsSchema.default(3500);
  const splitPlatformBpsSchema = bpsSchema.default(2500);

  const paymentModeSchema = z.literal("on_confirmation").default("on_confirmation");
  const acceptPaymentTermsSchema = z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === "boolean") return val;
      const normalized = val.trim().toLowerCase();
      return normalized === "true" || normalized === "on" || normalized === "1";
    })
    .refine((accepted) => accepted, {
      message: t(lang, "bounty_zod_terms_required"),
    });
  const acceptAgbTermsSchema = z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === "boolean") return val;
      const normalized = val.trim().toLowerCase();
      return normalized === "true" || normalized === "on" || normalized === "1";
    })
    .refine((accepted) => accepted, {
      message: t(lang, "bounty_zod_agb_required"),
    });

  return z.object({
    title: titleSchema,
    description: descriptionSchema,
    bonusAmount: bonusAmountSchema,
    bonusCurrency: currencySchema,
    location: locationSchema,
    industry: industrySchema,
    tags: tagsSchema,
    expiresAt: expiresAtSchema,
    splitInserentBps: splitInserentBpsSchema,
    splitCandidateBps: splitCandidateBpsSchema,
    splitPlatformBps: splitPlatformBpsSchema,
    paymentMode: paymentModeSchema,
    acceptPaymentTerms: acceptPaymentTermsSchema,
    acceptAgbTerms: acceptAgbTermsSchema,
  });
}

export function createBountyCreateSchema(lang: Lang) {
  return buildBountyBaseSchema(lang)
    .refine((d) => d.splitInserentBps + d.splitCandidateBps + d.splitPlatformBps === 10_000, {
      message: t(lang, "bounty_zod_split_sum"),
    })
    .refine((d) => d.splitPlatformBps >= 500, {
      message: t(lang, "bounty_zod_split_platform_min"),
    });
}

/** Default für Tests & Legacy-Imports; UI/Server nutzen `createBountyCreateSchema(lang)`. */
export const bountyCreateSchema = createBountyCreateSchema("de");

export function createBountyUpdateSchema(lang: Lang) {
  return buildBountyBaseSchema(lang).partial();
}

export const bountyUpdateSchema = createBountyUpdateSchema("de");

export function createBountyIdSchema(lang: Lang) {
  return z.object({
    id: z.string().uuid(t(lang, "bounty_zod_id_invalid")),
  });
}

export const bountyIdSchema = createBountyIdSchema("de");

export type BountyCreateInput = z.infer<typeof bountyCreateSchema>;
export type BountyUpdateInput = z.infer<typeof bountyUpdateSchema>;
