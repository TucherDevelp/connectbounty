import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

const DOC_LABELS: Record<string, string> = {
  id_card_front: "Personalausweis Vorderseite",
  id_card_back: "Personalausweis Rückseite",
  passport: "Reisepass",
  selfie: "Selfie",
};

const DOC_ORDER = ["id_card_front", "id_card_back", "passport", "selfie"];

interface DocRow {
  id: string;
  document_type: string;
  storage_path: string;
}

interface KycDocumentGalleryProps {
  applicantId: string;
  docs: DocRow[];
}

/**
 * Server-Komponente: generiert signierte Supabase-Storage-URLs (60 min)
 * und rendert die Dokument-Thumbnails für den Admin-Review.
 */
export async function KycDocumentGallery({ docs }: KycDocumentGalleryProps) {
  const sb = getSupabaseServiceRoleClient();

  const sorted = [...docs].sort(
    (a, b) => DOC_ORDER.indexOf(a.document_type) - DOC_ORDER.indexOf(b.document_type),
  );

  const urls = await Promise.all(
    sorted.map(async (doc) => {
      const { data } = await sb.storage
        .from("kyc-documents")
        .createSignedUrl(doc.storage_path, 3600);
      return { ...doc, signedUrl: data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {urls.map((doc) => (
        <div key={doc.id} className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">
            {DOC_LABELS[doc.document_type] ?? doc.document_type}
          </p>
          {doc.signedUrl ? (
            <a
              href={doc.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block h-28 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface-2)]"
              title="In neuem Tab öffnen"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signierte Nutzerfotos */}
              <img
                src={doc.signedUrl}
                alt={DOC_LABELS[doc.document_type] ?? doc.document_type}
                className="absolute inset-0 size-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 text-xs text-white font-medium">
                Vollbild
              </span>
            </a>
          ) : (
            <div className="flex h-28 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
              URL fehlt
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
