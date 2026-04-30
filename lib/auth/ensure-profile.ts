import "server-only";

import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type ProfileRow = {
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
};

const CORE_SELECT = "display_name, bio, avatar_url";
const FULL_SELECT =
  "display_name, bio, avatar_url, address_line1, address_line2, address_postal_code, address_city, address_country";

const EMPTY_ADDRESS = {
  address_line1: null,
  address_line2: null,
  address_postal_code: null,
  address_city: null,
  address_country: null,
} satisfies Pick<
  ProfileRow,
  "address_line1" | "address_line2" | "address_postal_code" | "address_city" | "address_country"
>;

/**
 * Loads the profile row for the given user.
 *
 * Resilient to missing address_* columns (the live DB might be on an older
 * migration than the codebase expects). First tries the FULL select; if that
 * fails because address columns don't exist, falls back to CORE select and
 * fills the address fields with null.
 *
 * If no row exists at all, creates a minimal one via service role.
 */
export async function ensureProfileForUser(user: User): Promise<ProfileRow> {
  const sb = await getSupabaseServerClient();

  // ── Try full SELECT first ────────────────────────────────────────────────
  const fullRes = await sb.from("profiles").select(FULL_SELECT).eq("id", user.id).maybeSingle();

  if (fullRes.data) return fullRes.data as ProfileRow;

  // If the FULL select errored because address_* columns are missing, retry
  // with the core columns only. Errors that aren't column-not-found bubble
  // up via the row missing path below.
  const errorIsMissingAddress =
    fullRes.error && /column .*address.* does not exist/i.test(fullRes.error.message);

  if (errorIsMissingAddress) {
    const coreRes = await sb.from("profiles").select(CORE_SELECT).eq("id", user.id).maybeSingle();
    if (coreRes.data) {
      return { ...(coreRes.data as Pick<ProfileRow, "display_name" | "bio" | "avatar_url">), ...EMPTY_ADDRESS };
    }
    // Row genuinely missing — fall through to insert below
  } else if (fullRes.error) {
    console.error("[ensureProfileForUser] select error:", fullRes.error.message);
  }

  // ── Row missing → create via service role ────────────────────────────────
  const fallbackName =
    (user.user_metadata?.display_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Neuer Nutzer";

  const serviceSb = getSupabaseServiceRoleClient();

  // Insert with ONLY core columns — address columns might not exist yet.
  // If address columns do exist, the trigger / default values handle them.
  const insertRes = await serviceSb
    .from("profiles")
    .insert({ id: user.id, display_name: fallbackName })
    .select(CORE_SELECT)
    .maybeSingle();

  if (insertRes.error) {
    // Duplicate-key on `id` (23505) means another request already inserted it
    // — re-read with core select.
    const isDuplicate = (insertRes.error as { code?: string }).code === "23505";
    if (isDuplicate) {
      const reread = await sb.from("profiles").select(CORE_SELECT).eq("id", user.id).maybeSingle();
      if (reread.data) {
        return {
          ...(reread.data as Pick<ProfileRow, "display_name" | "bio" | "avatar_url">),
          ...EMPTY_ADDRESS,
        };
      }
    }
    console.error("[ensureProfileForUser] insert error:", insertRes.error.message);
    return { display_name: fallbackName, bio: null, avatar_url: null, ...EMPTY_ADDRESS };
  }

  return {
    ...((insertRes.data as Pick<ProfileRow, "display_name" | "bio" | "avatar_url">) ?? {
      display_name: fallbackName,
      bio: null,
      avatar_url: null,
    }),
    ...EMPTY_ADDRESS,
  };
}
