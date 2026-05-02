import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { KycStatus } from "@/lib/supabase/types";
import { adminSetKycAction, adminDeleteUserAction, adminReprocessUserAction } from "@/lib/admin/user-actions";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_admin_users_title" });
}
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const KYC_STATUSES: KycStatus[] = ["unverified", "pending", "approved", "rejected", "expired"];

const KYC_FILTER_LABEL: Record<KycStatus, TranslationKey> = {
  unverified: "kyc_badge_unverified",
  pending: "kyc_badge_pending",
  approved: "kyc_badge_approved",
  rejected: "kyc_badge_rejected",
  expired: "kyc_badge_expired",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

  const sp = await searchParams;
  const filterKyc = typeof sp.kyc === "string" ? sp.kyc : "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sb = getSupabaseServiceRoleClient();

  let q = sb
    .from("profiles")
    .select("id, display_name, kyc_status, created_at, last_seen_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filterKyc) q = q.eq("kyc_status", filterKyc as KycStatus);

  const { data, error, count } = await q;

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        title={t(lang, "admin_users_title")}
        description={t(lang, "admin_users_desc_total").replace("{count}", String(total))}
      />

      <form method="GET" action="/admin/users" className="mb-5 flex flex-wrap gap-2">
        <button name="kyc" value="" type="submit"
          className={["rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !filterKyc ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
              : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"].join(" ")}>
          {t(lang, "admin_filter_all")}
        </button>
        {KYC_STATUSES.map((s) => (
          <button key={s} name="kyc" value={s} type="submit"
            className={["rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filterKyc === s ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"].join(" ")}>
            {t(lang, KYC_FILTER_LABEL[s])}
          </button>
        ))}
      </form>

      {error && (
        <div className="mb-4 text-sm text-[var(--color-error)]">
          {t(lang, "admin_error_colon_message").replace("{message}", error.message)}
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-surface-border)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-surface-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
            <tr>
              {(
                [
                  "admin_users_col_name_id",
                  "admin_users_col_kyc",
                  "admin_users_col_registered",
                  "admin_users_col_last_active",
                  "admin_users_col_set_kyc",
                  "admin_bounty_col_actions",
                ] as const
              ).map((key) => (
                <th key={key} className="px-4 py-3 text-left font-medium">
                  {t(lang, key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-surface-border)] bg-[var(--color-surface-1)]">
            {(data ?? []).map((u) => (
              <tr key={u.id} className="hover:bg-[var(--color-surface-2)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {u.display_name ?? t(lang, "admin_users_no_display_name")}
                  </p>
                  <p className="font-mono text-xs text-[var(--color-text-faint)]">{u.id.slice(0, 8)}</p>
                </td>
                <td className="px-4 py-3">
                  <KycStatusBadge status={u.kyc_status as KycStatus} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                  {formatDate(u.created_at) ?? "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                  {formatDate(u.last_seen_at) ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {u.kyc_status !== "approved" && (
                      <form action={adminSetKycAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="status" value="approved" />
                        <Button size="sm" variant="secondary" type="submit">
                          {t(lang, "admin_users_btn_kyc_approve")}
                        </Button>
                      </form>
                    )}
                    {u.kyc_status !== "rejected" && (
                      <form action={adminSetKycAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <Button size="sm" variant="ghost" type="submit">
                          {t(lang, "admin_btn_reject")}
                        </Button>
                      </form>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <form action={adminDeleteUserAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button size="sm" variant="ghost" type="submit"
                        className="text-[var(--color-error)] hover:bg-[color-mix(in_oklab,var(--color-error)_10%,transparent)]">
                        {t(lang, "admin_btn_delete")}
                      </Button>
                    </form>
                    <form action={adminReprocessUserAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button size="sm" variant="ghost" type="submit"
                        className="text-[var(--color-warning)] hover:bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)]">
                        {t(lang, "admin_btn_reprocess")}
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  {t(lang, "admin_users_empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <a
              href={`/admin/users?kyc=${filterKyc}&page=${page - 1}`}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-surface-border)] px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              {t(lang, "admin_pagination_back")}
            </a>
          )}
          <span className="text-[var(--color-text-muted)]">
            {t(lang, "admin_pagination_page")
              .replace("{current}", String(page))
              .replace("{total}", String(totalPages))}
          </span>
          {page < totalPages && (
            <a
              href={`/admin/users?kyc=${filterKyc}&page=${page + 1}`}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-surface-border)] px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {t(lang, "admin_pagination_next")}
              <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            </a>
          )}
        </nav>
      )}
    </section>
  );
}
