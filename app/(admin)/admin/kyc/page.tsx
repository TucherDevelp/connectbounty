import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { Button } from "@/components/ui/button";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { adminReviewKycAction } from "@/lib/admin/kyc-actions";
import { KycDocumentGallery } from "./document-gallery";

export const metadata: Metadata = { title: "Admin – KYC Review" };
export const dynamic = "force-dynamic";

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const sb = getSupabaseServiceRoleClient();

  type DocRow = { id: string; document_type: string; storage_path: string };

  type PendingApp = {
    id: string;
    applicant_id: string;
    level_name: string;
    status: string;
    reject_labels: string[] | null;
    reviewed_at: string | null;
    created_at: string;
    user_id: string;
    profiles: { display_name: string | null } | { display_name: string | null }[] | null;
    kyc_documents: DocRow[] | null;
  };

  type RecentApp = {
    id: string;
    applicant_id: string;
    status: string;
    reviewed_at: string | null;
    created_at: string;
    user_id: string;
    profiles: { display_name: string | null } | { display_name: string | null }[] | null;
  };

  // Alle pending Anträge mit Dokumenten
  const { data: pendingRaw } = await sb
    .from("kyc_applicants")
    .select(`
      id,
      applicant_id,
      level_name,
      status,
      reject_labels,
      reviewed_at,
      created_at,
      user_id,
      profiles!user_id ( display_name ),
      kyc_documents ( id, document_type, storage_path )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const pending = pendingRaw as PendingApp[] | null;

  // Kürzlich entschiedene (letzten 20)
  const { data: recentRaw } = await sb
    .from("kyc_applicants")
    .select(`
      id,
      applicant_id,
      status,
      reviewed_at,
      created_at,
      user_id,
      profiles!user_id ( display_name )
    `)
    .in("status", ["approved", "rejected", "expired"])
    .order("reviewed_at", { ascending: false })
    .limit(20);

  const recent = recentRaw as RecentApp[] | null;

  const reviewedApplicantId = sp.reviewed;

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        title="KYC Review"
        description={`${pending?.length ?? 0} Anträge ausstehend`}
      />

      {reviewedApplicantId && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          Antrag {reviewedApplicantId.slice(0, 12)}… wurde erfolgreich bearbeitet.
        </div>
      )}

      {sp.error && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          Fehler: {sp.error}
        </div>
      )}

      {/* Ausstehende Anträge */}
      {!pending?.length && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            Keine ausstehenden KYC-Anträge.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-6">
        {pending?.map((app) => {
          type Profile = { display_name: string | null } | null;
          const profile = Array.isArray(app.profiles)
            ? (app.profiles[0] as Profile)
            : (app.profiles as Profile);

          const docs: DocRow[] = Array.isArray(app.kyc_documents)
            ? (app.kyc_documents as DocRow[])
            : app.kyc_documents
            ? [app.kyc_documents as DocRow]
            : [];

          return (
            <Card key={app.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    {profile?.display_name ?? "Unbekannt"}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    Antrag-ID:{" "}
                    <code className="rounded bg-[var(--color-surface-2)] px-1 py-0.5">
                      {app.applicant_id}
                    </code>
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Eingereicht: {formatDate(app.created_at)}
                  </p>
                </div>
                <KycStatusBadge status={app.status as "pending"} />
              </CardHeader>

              <CardContent className="flex flex-col gap-5">
                {/* Dokument-Vorschau */}
                {docs.length > 0 ? (
                  <KycDocumentGallery applicantId={app.id} docs={docs} />
                ) : (
                  <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                    Noch keine Dokumente hochgeladen.
                  </p>
                )}

                {/* Entscheidungsformular */}
                <form
                  action={adminReviewKycAction}
                  className="flex flex-col gap-3 border-t border-[var(--color-surface-border)] pt-4"
                >
                  <input type="hidden" name="applicantId" value={app.applicant_id} />
                  <input type="hidden" name="userId" value={app.user_id} />

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`reason-${app.id}`}
                      className="text-xs font-medium text-[var(--color-text-muted)]"
                    >
                      Ablehnungsgrund (optional, nur bei Ablehnung)
                    </label>
                    <input
                      id={`reason-${app.id}`}
                      name="rejectReason"
                      type="text"
                      placeholder="z.B. Dokument unleserlich, Selfie stimmt nicht überein …"
                      className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-400)]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      name="decision"
                      value="approved"
                      size="sm"
                      variant="primary"
                      disabled={docs.length === 0}
                    >
                      Freigeben ✓
                    </Button>
                    <Button
                      type="submit"
                      name="decision"
                      value="rejected"
                      size="sm"
                      variant="destructive"
                    >
                      Ablehnen ✗
                    </Button>
                  </div>

                  {docs.length === 0 && (
                    <p className="text-xs text-[var(--color-warning)]">
                      Freigabe erst möglich, wenn Dokumente hochgeladen wurden.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Kürzlich entschieden */}
      {(recent?.length ?? 0) > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            Kürzlich entschieden
          </h2>
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-surface-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-surface-border)] bg-[var(--color-surface-2)]">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)]">Nutzer</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)]">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)]">Entschieden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-surface-border)]">
                {recent?.map((app) => {
                  type RecentProfile = { display_name: string | null } | null;
                  const profile = Array.isArray(app.profiles)
                    ? (app.profiles[0] as RecentProfile)
                    : (app.profiles as RecentProfile);
                  return (
                    <tr key={app.id} className="hover:bg-[var(--color-surface-2)]">
                      <td className="px-4 py-2 text-[var(--color-text-primary)]">
                        {profile?.display_name ?? "–"}
                      </td>
                      <td className="px-4 py-2">
                        <KycStatusBadge status={app.status as "approved"} />
                      </td>
                      <td className="px-4 py-2 text-[var(--color-text-muted)]">
                        {app.reviewed_at ? formatDate(app.reviewed_at) : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
