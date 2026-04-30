import { NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * GET /api/debug/profile
 *
 * Diagnostic endpoint — shows what is ACTUALLY stored in the profiles table
 * for the currently logged-in user. Useful for verifying that saves work.
 *
 * Only works in development mode (returns 403 in production).
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated", detail: authErr?.message }, { status: 401 });
  }

  const serviceSb = getSupabaseServiceRoleClient();

  // Read directly via service role — bypasses all RLS
  const { data: profile, error: profileErr } = await serviceSb
    .from("profiles")
    .select("id, display_name, bio, avatar_url, address_city, address_country, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile: profile ?? null,
    profileError: profileErr?.message ?? null,
    storageBuckets: await (async () => {
      const { data: buckets } = await serviceSb.storage.listBuckets();
      return buckets?.map((b) => b.name) ?? [];
    })(),
  });
}
