import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { BountyStatusBadge } from "@/components/bounty/status-badge";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { formatBonus, formatDate } from "@/lib/format";
import type { BountyStatus } from "@/lib/supabase/types";
import {
  adminApproveBountyAction,
  adminRejectBountyAction,
  adminCloseBountyAction,
  adminDeleteBountyAction,
  adminReprocessBountyAction,
} from "@/lib/admin/bounty-actions";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_admin_bounties_title" });
}
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

const STATUS_FILTER_OPTIONS: { value: string; labelKey: TranslationKey }[] = [
  { value: "", labelKey: "admin_filter_all" },
  { value: "pending_review", labelKey: "bounty_status_pending_review" },
  { value: "open", labelKey: "bounty_status_open" },
  { value: "draft", labelKey: "bounty_status_draft" },
  { value: "expired", labelKey: "bounty_status_expired" },
  { value: "closed", labelKey: "bounty_status_closed" },
  { value: "cancelled", labelKey: "bounty_status_cancelled" },
];

export default async function AdminBountiesPage({
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
    .from("bounties")
    .select(
      "id, title, bonus_amount, bonus_currency, status, owner_id, published_at, created_at, expires_at, profiles!bounties_owner_id_fkey(display_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filterStatus) q = q.eq("status", filterStatus as BountyStatus);

  const { data, error, count } = await q;

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pendingCount = filterStatus === ""
    ? (data ?? []).filter((b) => b.status === "pending_review").length
    : 0;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        title={t(lang, "nav_admin_bounties")}
        description={t(lang, "admin_list_entries_total").replace("{count}", String(total))}
      />

      {pendingCount > 0 && (
        <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-warning)]/40 bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-warning)]">
          {t(lang, "admin_items_pending_review").replace("{n}", String(pendingCount))}
        </div>
      )}

      {/* Filter */}
      <form method="GET" action="/admin/bounties" className="mb-5 flex flex-wrap gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            name="status"
            value={opt.value}
            type="submit"
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filterStatus === opt.value
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
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
                  "admin_bounty_col_title",
                  "admin_bounty_col_owner",
                  "admin_bounty_col_bonus",
                  "admin_bounty_col_status",
                  "admin_bounty_col_created",
                  "admin_bounty_col_expires",
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
            {(data ?? []).map((b) => {
              const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
              const status = b.status as BountyStatus;
              return (
                <tr
                  key={b.id}
                  className={[
                    "hover:bg-[var(--color-surface-2)]",
                    status === "pending_review" ? "bg-[color-mix(in_oklab,var(--color-warning)_5%,transparent)]" : "",
                  ].join(" ")}
                >
                  <td className="max-w-xs px-4 py-3">
                    <a
                      href={`/bounties/${b.id}`}
                      className="truncate font-medium text-[var(--color-text-primary)] hover:text-[var(--color-brand)]"
                    >
                      {b.title}
                    </a>
                    <p className="mt-0.5 font-mono text-xs text-[var(--color-text-faint)]">{b.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    {profile?.display_name ?? b.owner_id.slice(0, 8)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatBonus(Number(b.bonus_amount), b.bonus_currency)}
                  </td>
                  <td className="px-4 py-3">
                    <BountyStatusBadge status={status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                    {formatDate(b.created_at) ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                    {formatDate(b.expires_at) ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {status === "pending_review" && (
                        <>
                          <form action={adminApproveBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button size="sm" variant="primary" type="submit">
                              {t(lang, "admin_btn_publish")}
                            </Button>
                          </form>
                          <form action={adminRejectBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button size="sm" variant="secondary" type="submit">
                              {t(lang, "admin_btn_reject")}
                            </Button>
                          </form>
                        </>
                      )}
                      {status === "open" && (
                        <form action={adminCloseBountyAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <Button size="sm" variant="secondary" type="submit">
                            {t(lang, "admin_btn_close")}
                          </Button>
                        </form>
                      )}
                      <form
                        action={adminDeleteBountyAction}
                        onSubmit={undefined}
                      >
                        <input type="hidden" name="id" value={b.id} />
                        <Button size="sm" variant="ghost" type="submit"
                          className="text-[var(--color-error)] hover:bg-[color-mix(in_oklab,var(--color-error)_10%,transparent)]">
                          {t(lang, "admin_btn_delete")}
                        </Button>
                      </form>
                      <form action={adminReprocessBountyAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <Button size="sm" variant="ghost" type="submit"
                          className="text-[var(--color-warning)] hover:bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)]">
                          {t(lang, "admin_btn_reprocess")}
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  {t(lang, "admin_bounties_empty")}
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
              href={`/admin/bounties?status=${filterStatus}&page=${page - 1}`}
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
              href={`/admin/bounties?status=${filterStatus}&page=${page + 1}`}
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
