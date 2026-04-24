import { NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["id_card_front", "id_card_back", "passport", "selfie"] as const;
type DocType = (typeof ALLOWED_TYPES)[number];

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = "kyc-documents";

/**
 * POST /api/kyc/documents
 *
 * Nimmt ein Multipart-Formular mit:
 *   applicantId  - UUID des kyc_applicants-Eintrags
 *   documentType - 'id_card_front' | 'id_card_back' | 'passport' | 'selfie'
 *   file         - Bilddatei (JPEG / PNG / WebP, max 10 MB)
 *
 * Ablauf:
 *   1. Session-User verifizieren (must own the applicant)
 *   2. File validieren (Typ, Größe)
 *   3. Upload in Supabase Storage (Bucket: kyc-documents, private)
 *   4. Metadaten in kyc_documents speichern
 *   5. { storagePath } zurückgeben
 */
export async function POST(request: Request) {
  const userClient = await getSupabaseServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültiges Formular" }, { status: 400 });
  }

  const applicantId = form.get("applicantId");
  const documentType = form.get("documentType");
  const file = form.get("file");

  if (
    typeof applicantId !== "string" ||
    typeof documentType !== "string" ||
    !(file instanceof File)
  ) {
    return NextResponse.json({ error: "Fehlende Felder" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(documentType as DocType)) {
    return NextResponse.json({ error: "Unbekannter Dokumenttyp" }, { status: 400 });
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "Nur JPEG, PNG und WebP erlaubt" },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Datei zu groß (max 10 MB)" }, { status: 400 });
  }

  const sb = getSupabaseServiceRoleClient();

  // Prüfen ob der Antrag dem User gehört
  const { data: applicant } = await sb
    .from("kyc_applicants")
    .select("id, user_id, status")
    .eq("id", applicantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!applicant) {
    return NextResponse.json({ error: "Antrag nicht gefunden" }, { status: 404 });
  }

  if (applicant.status !== "pending") {
    return NextResponse.json(
      { error: "Dokumente können nur für offene Anträge hochgeladen werden" },
      { status: 409 },
    );
  }

  // Datei-Extension
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${user.id}/${applicantId}/${documentType}.${ext}`;

  // Upload (upsert - bei Wiederholung wird überschrieben)
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Metadaten in DB - upsert auf (applicant_id, document_type)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (sb as any).from("kyc_documents").upsert(
    {
      applicant_id: applicantId,
      user_id: user.id,
      document_type: documentType,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
    },
    { onConflict: "applicant_id,document_type" },
  );

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ storagePath });
}
