import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

const ALLOWED_BUCKETS = ["hire-proofs"] as const;

/**
 * POST /api/storage/sign-upload
 *
 * Erstellt eine signierte Upload-URL für den angegebenen Bucket + Pfad.
 * Die URL läuft nach 60 Sekunden ab (ausreichend für einen Upload).
 *
 * Body: { bucket: string; path: string }
 * Response: { signedUrl: string }
 *
 * Sicherheit:
 *   • Auth-Session wird geprüft bevor die Signed-URL ausgestellt wird.
 *   • Bucket muss in der Allowlist stehen.
 *   • Service-Role-Client für die Signed-URL-Erstellung (nicht im Browser).
 */
export async function POST(request: Request) {
  // Auth prüfen
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const { bucket, path } = body as { bucket?: string; path?: string };

  if (!bucket || !ALLOWED_BUCKETS.includes(bucket as typeof ALLOWED_BUCKETS[number])) {
    return NextResponse.json({ error: "Ungültiger Bucket" }, { status: 400 });
  }
  if (!path || path.includes("..") || path.length > 500) {
    return NextResponse.json({ error: "Ungültiger Pfad" }, { status: 400 });
  }

  // Signed URL via Service-Role (umgeht Storage-RLS)
  const sb = getSupabaseServiceRoleClient();
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Signed URL konnte nicht erstellt werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
