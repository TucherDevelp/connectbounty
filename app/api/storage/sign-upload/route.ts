import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { clientEnv } from "@/lib/env";

const ALLOWED_BUCKETS = ["hire-proofs", "profile-avatars", "rejection-documents"] as const;

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

  // Auto-create the bucket if it does not exist yet.
  // This happens when migrations haven't been applied to the Supabase project
  // (migration 0010_profile_avatar_bucket.sql creates the bucket via SQL).
  const BUCKET_CONFIG: Record<
    string,
    { public: boolean; mimeTypes: string[]; sizeLimit: number }
  > = {
    "profile-avatars": {
      public: true,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      sizeLimit: 5 * 1024 * 1024,
    },
    "hire-proofs": {
      public: false,
      mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      sizeLimit: 10 * 1024 * 1024,
    },
    "rejection-documents": {
      public: false,
      mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      sizeLimit: 10 * 1024 * 1024,
    },
  };
  const bucketCfg = BUCKET_CONFIG[bucket];
  if (bucketCfg) {
    const { error: bucketErr } = await sb.storage.createBucket(bucket, {
      public: bucketCfg.public,
      allowedMimeTypes: bucketCfg.mimeTypes,
      fileSizeLimit: bucketCfg.sizeLimit,
    });
    // "already exists" (23505 / Duplicate) is fine — ignore it
    if (bucketErr && !bucketErr.message.toLowerCase().includes("already exist")) {
      console.error("[sign-upload] bucket auto-create error:", bucketErr.message);
      // non-fatal: continue and try the signed URL anyway
    }
  }

  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[sign-upload] createSignedUploadUrl error:", error?.message, "bucket:", bucket);
    return NextResponse.json(
      { error: error?.message ?? "Signed URL konnte nicht erstellt werden" },
      { status: 500 },
    );
  }

  const env = clientEnv();
  const signedUrl = data.signedUrl.startsWith("http")
    ? data.signedUrl
    : `${env.NEXT_PUBLIC_SUPABASE_URL}${data.signedUrl}`;

  return NextResponse.json({ signedUrl });
}
