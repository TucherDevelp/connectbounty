import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Check, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { Button } from "@/components/ui/button";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t } from "@/lib/i18n";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { adminReviewKycAction } from "@/lib/admin/kyc-actions";
import { KycDocumentGallery } from "./document-gallery";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_admin_kyc_title" });
}
export const dynamic = "force-dynamic";

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

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
        title={t(lang, "admin_kyc_page_title")}
        description={t(lang, "admin_kyc_page_desc_pending").replace(
          "{count}",
          String(pending?.length ?? 0),
        )}
      />

      {reviewedApplicantId && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          {t(lang, "admin_kyc_reviewed_banner").replace(
            "{id}",
            reviewedApplicantId.slice(0, 12),
          )}
        </div>
      )}

      {sp.error && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          {t(lang, "admin_kyc_error_prefix")} {sp.error}
        </div>
      )}

      {/* Ausstehende Anträge */}
      {!pending?.length && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            {t(lang, "admin_kyc_empty_pending")}
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
                    {profile?.display_name ?? t(lang, "admin_kyc_unknown_user")}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {t(lang, "admin_kyc_applicant_id_label")}{" "}
                    <code className="rounded bg-[var(--color-surface-2)] px-1 py-0.5">
                      {app.applicant_id}
                    </code>
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t(lang, "admin_kyc_submitted_label")} {formatDate(app.created_at)}
                  </p>
                </div>
                <KycStatusBadge status={app.status as "pending"} />
              </CardHeader>

              <CardContent className="flex flex-col gap-5">
                {/* Dokument-Vorschau */}
                {docs.length > 0 ? (
                  <KycDocumentGallery applicantId={app.id} docs={docs} lang={lang} />
                ) : (
                  <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                    {t(lang, "admin_kyc_no_docs")}
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
                      {t(lang, "admin_kyc_reject_reason_label")}
                    </label>
                    <input
                      id={`reason-${app.id}`}
                      name="rejectReason"
                      type="text"
                      placeholder={t(lang, "admin_kyc_reject_reason_placeholder")}
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
                      <span className="inline-flex items-center gap-1.5">
                        {t(lang, "admin_btn_publish")}
                        <Check className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                      </span>
                    </Button>
                    <Button
                      type="submit"
                      name="decision"
                      value="rejected"
                      size="sm"
                      variant="destructive"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {t(lang, "admin_btn_reject")}
                        <X className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                      </span>
                    </Button>
                  </div>

                  {docs.length === 0 && (
                    <p className="text-xs text-[var(--color-warning)]">
                      {t(lang, "admin_kyc_approve_requires_docs")}
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
            {t(lang, "admin_kyc_recent_heading")}
          </h2>
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-surface-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-surface-border)] bg-[var(--color-surface-2)]">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)]">
                    {t(lang, "admin_kyc_recent_col_user")}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)]">
                    {t(lang, "admin_kyc_recent_col_status")}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-text-muted)]">
                    {t(lang, "admin_kyc_recent_col_decided")}
                  </th>
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
                        {profile?.display_name ?? "-"}
                      </td>
                      <td className="px-4 py-2">
                        <KycStatusBadge status={app.status as "approved"} />
                      </td>
                      <td className="px-4 py-2 text-[var(--color-text-muted)]">
                        {app.reviewed_at ? formatDate(app.reviewed_at) : "-"}
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
