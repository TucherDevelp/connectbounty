import "server-only";

import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { BountyStatus, ReferralStatus } from "@/lib/supabase/types";

/**
 * Wiederverwendbare Lese-Queries für das Marketplace-Modul.
 *
 * Regeln:
 *   • Alle Queries laufen gegen RLS. Diese Datei erzwingt KEINE zusätzlichen
 *     Guards - die Policies aus 0003_marketplace.sql sind die Single Source
 *     of Truth.
 *   • Public-Lists schließen abgelaufene Bounties immer aus (expires_at).
 *   • Keine JOINs über FKs ohne explizite Spaltenwahl - vermeidet N+1 und
 *     lässt die Absicht sichtbar bleiben.
 */

// ── Filter-Schema (verbindet Query-String mit DB) ──────────────────────────

export const bountyFiltersSchema = z.object({
  q: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  industry: z.string().trim().max(80).optional().transform((v) => (v ? v : undefined)),
  location: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
  tag: z
    .preprocess(
      (v) => {
        if (v === undefined || v === null) return undefined;
        const s = String(v).trim().toLowerCase();
        return s === "" ? undefined : s;
      },
      z
        .string()
        .regex(/^[a-z0-9][a-z0-9\-._]*$/, "Ungültiger Tag")
        .max(32)
        .optional(),
    ),
  minBonus: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val, ctx) => {
      if (val === undefined || val === "") return undefined;
      const n = typeof val === "number" ? val : Number(String(val).replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: "Ungültige Mindestprämie" });
        return z.NEVER;
      }
      return n;
    }),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === "") return 1;
      const n = typeof val === "number" ? val : Number(val);
      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    }),
});

export type BountyFilters = z.infer<typeof bountyFiltersSchema>;

export const PAGE_SIZE = 20;

// ── Public Listing ────────────────────────────────────────────────────────

export type BountyListItem = {
  id: string;
  title: string;
  description: string;
  bonus_amount: number;
  bonus_currency: string;
  location: string | null;
  industry: string | null;
  tags: string[];
  status: BountyStatus;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type BountyListResult = {
  items: BountyListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * Markiert abgelaufene Bounties (expires_at < now()) auf status='expired'.
 * Lazy-Check: wird vor dem Public-Listing aufgerufen, damit die Liste immer
 * aktuell ist, ohne einen dedizierten Cron-Job vorauszusetzen.
 * Fehler werden still geschluckt - ein nicht aktualisierter Status ist
 * besser als ein Ausfall des Listings.
 */
export async function expireStaleBounciesLazy(): Promise<void> {
  try {
    const supabase = await getSupabaseServerClient();
    await supabase.rpc("expire_stale_bounties");
  } catch {
    // intentionally silent - stale status is cosmetic, not security-critical
  }
}

/**
 * Liefert die öffentlich sichtbaren (status=open, nicht abgelaufen) Bounties
 * paginiert & gefiltert. Nutzt die Server-seitige Supabase-Instanz - RLS
 * blendet closed/draft/cancelled automatisch aus.
 */
export async function listOpenBounties(
  filters: BountyFilters,
): Promise<BountyListResult> {
  const supabase = await getSupabaseServerClient();
  const page = filters.page ?? 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("bounties")
    .select(
      "id, title, description, bonus_amount, bonus_currency, location, industry, tags, status, published_at, expires_at, created_at",
      { count: "exact" },
    )
    .eq("status", "open")
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (filters.q) {
    // .or(ilike) für mehrere Spalten - keine FTS, aber ausreichend für MVP.
    // Werte escapen: nur Kommas & Klammern sind PostgREST-Syntax; unser
    // Schema limitiert max 120 Zeichen → in der Praxis ungefährlich.
    const safe = filters.q.replaceAll(",", "").replaceAll("(", "").replaceAll(")", "");
    query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (filters.industry) query = query.ilike("industry", filters.industry);
  if (filters.location) query = query.ilike("location", `%${filters.location}%`);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.minBonus !== undefined) query = query.gte("bonus_amount", filters.minBonus);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    items: (data ?? []) as BountyListItem[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    hasMore: (count ?? 0) > to + 1,
  };
}

// ── Detail ────────────────────────────────────────────────────────────────

export type BountyDetail = BountyListItem & {
  owner_id: string;
};

/**
 * Holt eine Bounty per ID plus öffentlichen Teil des Owner-Profils.
 * RLS entscheidet, ob die Zeile sichtbar ist (open für alle, Drafts/closed
 * nur für Owner/Staff).
 */
export async function getBountyById(id: string): Promise<BountyDetail | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("bounties")
    .select(
      "id, title, description, bonus_amount, bonus_currency, location, industry, tags, status, published_at, expires_at, created_at, owner_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as BountyDetail;
}

// ── Referrals ─────────────────────────────────────────────────────────────

export type ReferralForBounty = {
  id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_contact: string | null;
  message: string | null;
  status: ReferralStatus;
  created_at: string;
  status_changed_at: string;
  referrer_id: string;
  referrer_display_name: string | null;
};

export async function listReferralsForBounty(
  bountyId: string,
): Promise<ReferralForBounty[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("bounty_referrals")
    .select(
      "id, candidate_name, candidate_email, candidate_contact, message, status, created_at, status_changed_at, referrer_id, profiles!bounty_referrals_referrer_id_fkey(display_name)",
    )
    .eq("bounty_id", bountyId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      candidate_name: row.candidate_name,
      candidate_email: row.candidate_email,
      candidate_contact: row.candidate_contact,
      message: row.message,
      status: row.status,
      created_at: row.created_at,
      status_changed_at: row.status_changed_at,
      referrer_id: row.referrer_id,
      referrer_display_name: profile?.display_name ?? null,
    };
  });
}

export type MyReferral = {
  id: string;
  bounty_id: string;
  bounty_title: string;
  bounty_status: BountyStatus;
  bonus_amount: number;
  bonus_currency: string;
  candidate_name: string;
  status: ReferralStatus;
  created_at: string;
  status_changed_at: string;
};

export async function listMyReferrals(userId: string): Promise<MyReferral[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("bounty_referrals")
    .select(
      "id, bounty_id, candidate_name, status, created_at, status_changed_at, bounties!bounty_referrals_bounty_id_fkey(title, status, bonus_amount, bonus_currency)",
    )
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const b = Array.isArray(row.bounties) ? row.bounties[0] : row.bounties;
    return {
      id: row.id,
      bounty_id: row.bounty_id,
      bounty_title: b?.title ?? "(gelöschte Bounty)",
      bounty_status: (b?.status ?? "cancelled") as BountyStatus,
      bonus_amount: Number(b?.bonus_amount ?? 0),
      bonus_currency: b?.bonus_currency ?? "EUR",
      candidate_name: row.candidate_name,
      status: row.status,
      created_at: row.created_at,
      status_changed_at: row.status_changed_at,
    };
  });
}
