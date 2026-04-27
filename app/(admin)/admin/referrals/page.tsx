import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ReferralStatusBadge } from "@/components/referral/status-badge";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { formatBonus, formatDate } from "@/lib/format";
import type { ReferralStatus } from "@/lib/supabase/types";
import {
  adminApproveReferralAction,
  adminRejectReferralAction,
  adminDeleteReferralAction,
} from "@/lib/admin/referral-actions";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_admin_referrals_title" });
}
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

const STATUS_OPTIONS: { value: string; labelKey: TranslationKey }[] = [
  { value: "", labelKey: "admin_filter_all" },
  { value: "pending_review", labelKey: "referral_status_pending_review" },
  { value: "submitted", labelKey: "referral_status_submitted" },
  { value: "contacted", labelKey: "referral_status_contacted" },
  { value: "interviewing", labelKey: "referral_status_interviewing" },
  { value: "hired", labelKey: "referral_status_hired" },
  { value: "paid", labelKey: "referral_status_paid" },
  { value: "rejected", labelKey: "referral_status_rejected" },
  { value: "withdrawn", labelKey: "referral_status_withdrawn" },
];

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

  const sp = await searchParams;
  const filterStatus = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sb = getSupabaseServiceRoleClient();

  let q = sb
    .from("bounty_referrals")
    .select(
      `id, candidate_name, candidate_email, status, created_at, status_changed_at,
       bounties!bounty_referrals_bounty_id_fkey(title, bonus_amount, bonus_currency),
       profiles!bounty_referrals_referrer_id_fkey(display_name)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filterStatus) q = q.eq("status", filterStatus as ReferralStatus);

  const { data, error, count } = await q;

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pendingCount = filterStatus === ""
    ? (data ?? []).filter((r) => r.status === "pending_review").length
    : 0;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        title={t(lang, "nav_admin_referrals")}
        description={t(lang, "admin_list_entries_total").replace("{count}", String(total))}
      />

      {pendingCount > 0 && (
        <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-warning)]/40 bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-warning)]">
          {t(lang, "admin_items_pending_review").replace("{n}", String(pendingCount))}
        </div>
      )}

      <form method="GET" action="/admin/referrals" className="mb-5 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button key={opt.value} name="status" value={opt.value} type="submit"
            className={["rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filterStatus === opt.value
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            ].join(" ")}>
            {t(lang, opt.labelKey)}
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
                  "admin_referral_col_candidate",
                  "admin_referral_col_bounty_bonus",
                  "admin_referral_col_referrer",
                  "admin_referral_col_status",
                  "admin_referral_col_submitted",
                  "admin_referral_col_actions",
                ] as const
              ).map((key) => (
                <th key={key} className="px-4 py-3 text-left font-medium">
                  {t(lang, key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-surface-border)] bg-[var(--color-surface-1)]">
            {(data ?? []).map((r) => {
              const bounty = Array.isArray(r.bounties) ? r.bounties[0] : r.bounties;
              const referrer = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
              const status = r.status as ReferralStatus;
              return (
                <tr
                  key={r.id}
                  className={[
                    "hover:bg-[var(--color-surface-2)]",
                    status === "pending_review" ? "bg-[color-mix(in_oklab,var(--color-warning)_5%,transparent)]" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text-primary)]">{r.candidate_name}</p>
                    <p className="text-xs text-[var(--color-text-faint)]">{r.candidate_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[var(--color-text-primary)]">{bounty?.title ?? "-"}</p>
                    {bounty && (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {formatBonus(Number(bounty.bonus_amount), bounty.bonus_currency)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    {referrer?.display_name ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <ReferralStatusBadge status={status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                    {formatDate(r.created_at) ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {status === "pending_review" && (
                        <>
                          <form action={adminApproveReferralAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button size="sm" variant="primary" type="submit">
                              {t(lang, "admin_btn_publish")}
                            </Button>
                          </form>
                          <form action={adminRejectReferralAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button size="sm" variant="secondary" type="submit">
                              {t(lang, "admin_btn_reject")}
                            </Button>
                          </form>
                        </>
                      )}
                      <form action={adminDeleteReferralAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button size="sm" variant="ghost" type="submit"
                          className="text-[var(--color-error)] hover:bg-[color-mix(in_oklab,var(--color-error)_10%,transparent)]">
                          {t(lang, "admin_btn_delete")}
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  {t(lang, "admin_referrals_empty")}
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
              href={`/admin/referrals?status=${filterStatus}&page=${page - 1}`}
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
              href={`/admin/referrals?status=${filterStatus}&page=${page + 1}`}
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
