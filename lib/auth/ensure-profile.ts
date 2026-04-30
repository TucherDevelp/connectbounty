import "server-only";

import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type ProfileRow = {
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
};

const FULL_SELECT =
  "display_name, bio, avatar_url, address_line1, address_line2, address_postal_code, address_city, address_country";

/**
 * Loads the profile row for the given user. If the row is missing
 * (e.g. the handle_new_user trigger never ran in this environment),
 * a minimal row is created from auth metadata so the rest of the app
 * always sees a valid profile.
 *
 * Returns the (possibly newly created) row.
 */
export async function ensureProfileForUser(user: User): Promise<ProfileRow> {
  const sb = await getSupabaseServerClient();
  const { data: existing } = await sb
    .from("profiles")
    .select(FULL_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return existing as ProfileRow;

  // Row missing → create via service role (RLS forbids client INSERT).
  const fallbackName =
    (user.user_metadata?.display_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Neuer Nutzer";

  const serviceSb = getSupabaseServiceRoleClient();
  const { data: created, error } = await serviceSb
    .from("profiles")
    .insert({ id: user.id, display_name: fallbackName })
    .select(FULL_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[ensureProfileForUser] insert error:", error.message);
    // Return a synthetic empty profile so the UI still works
    return {
      display_name: fallbackName,
      bio: null,
      avatar_url: null,
      address_line1: null,
      address_line2: null,
      address_postal_code: null,
      address_city: null,
      address_country: null,
    };
  }

  return (
    (created as ProfileRow) ?? {
      display_name: fallbackName,
      bio: null,
      avatar_url: null,
      address_line1: null,
      address_line2: null,
      address_postal_code: null,
      address_city: null,
      address_country: null,
    }
  );
}
