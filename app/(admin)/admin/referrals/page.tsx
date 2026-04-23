import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ReferralStatusBadge } from "@/components/referral/status-badge";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { formatBonus, formatDate } from "@/lib/format";
import type { ReferralStatus } from "@/lib/supabase/types";
import {
  adminApproveReferralAction,
  adminRejectReferralAction,
  adminDeleteReferralAction,
} from "@/lib/admin/referral-actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Admin – Empfehlungen" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Alle" },
  { value: "pending_review", label: "Zur Prüfung" },
  { value: "submitted", label: "Eingereicht" },
  { value: "contacted", label: "Kontaktiert" },
  { value: "interviewing", label: "Im Interview" },
  { value: "hired", label: "Eingestellt" },
  { value: "paid", label: "Ausgezahlt" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "withdrawn", label: "Zurückgezogen" },
];

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
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
      <PageHeader title="Empfehlungen" description={`${total} Einträge gesamt`} />

      {pendingCount > 0 && (
        <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--color-warning)]/40 bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-warning)]">
          {pendingCount} Empfehlung{pendingCount > 1 ? "en" : ""} warten auf Freigabe.
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
            {opt.label}
          </button>
        ))}
      </form>

      {error && <div className="mb-4 text-sm text-[var(--color-error)]">Fehler: {error.message}</div>}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-surface-border)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-surface-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
            <tr>
              {["Kandidat", "Bounty / Prämie", "Referrer", "Status", "Eingereicht", "Aktionen"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
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
                    <p className="text-[var(--color-text-primary)]">{bounty?.title ?? "–"}</p>
                    {bounty && (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {formatBonus(Number(bounty.bonus_amount), bounty.bonus_currency)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    {referrer?.display_name ?? "–"}
                  </td>
                  <td className="px-4 py-3">
                    <ReferralStatusBadge status={status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                    {formatDate(r.created_at) ?? "–"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {status === "pending_review" && (
                        <>
                          <form action={adminApproveReferralAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button size="sm" variant="primary" type="submit">
                              Freigeben
                            </Button>
                          </form>
                          <form action={adminRejectReferralAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button size="sm" variant="secondary" type="submit">
                              Ablehnen
                            </Button>
                          </form>
                        </>
                      )}
                      <form action={adminDeleteReferralAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button size="sm" variant="ghost" type="submit"
                          className="text-[var(--color-error)] hover:bg-[color-mix(in_oklab,var(--color-error)_10%,transparent)]">
                          Löschen
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
                  Keine Empfehlungen gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && <a href={`/admin/referrals?status=${filterStatus}&page=${page - 1}`} className="rounded border border-[var(--color-surface-border)] px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">← Zurück</a>}
          <span className="text-[var(--color-text-muted)]">Seite {page} / {totalPages}</span>
          {page < totalPages && <a href={`/admin/referrals?status=${filterStatus}&page=${page + 1}`} className="rounded border border-[var(--color-surface-border)] px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">Weiter →</a>}
        </nav>
      )}
    </section>
  );
}
