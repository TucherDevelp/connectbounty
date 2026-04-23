import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { KycStatus } from "@/lib/supabase/types";
import { adminSetKycAction } from "@/lib/admin/user-actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Admin – Nutzer & KYC" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const KYC_STATUSES: KycStatus[] = ["unverified", "pending", "approved", "rejected", "expired"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
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
      <PageHeader title="Nutzer & KYC" description={`${total} Nutzer gesamt`} />

      <form method="GET" action="/admin/users" className="mb-5 flex flex-wrap gap-2">
        <button name="kyc" value="" type="submit"
          className={["rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !filterKyc ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
              : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"].join(" ")}>
          Alle
        </button>
        {KYC_STATUSES.map((s) => (
          <button key={s} name="kyc" value={s} type="submit"
            className={["rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filterKyc === s ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"].join(" ")}>
            {s}
          </button>
        ))}
      </form>

      {error && <div className="mb-4 text-sm text-[var(--color-error)]">Fehler: {error.message}</div>}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-surface-border)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-surface-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
            <tr>
              {["Name / ID", "KYC-Status", "Registriert", "Zuletzt aktiv", "KYC setzen"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-surface-border)] bg-[var(--color-surface-1)]">
            {(data ?? []).map((u) => (
              <tr key={u.id} className="hover:bg-[var(--color-surface-2)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {u.display_name ?? "(kein Name)"}
                  </p>
                  <p className="font-mono text-xs text-[var(--color-text-faint)]">{u.id.slice(0, 8)}</p>
                </td>
                <td className="px-4 py-3">
                  <KycStatusBadge status={u.kyc_status as KycStatus} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                  {formatDate(u.created_at) ?? "–"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                  {formatDate(u.last_seen_at) ?? "–"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {u.kyc_status !== "approved" && (
                      <form action={adminSetKycAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="status" value="approved" />
                        <Button size="sm" variant="secondary" type="submit">Genehmigen</Button>
                      </form>
                    )}
                    {u.kyc_status !== "rejected" && (
                      <form action={adminSetKycAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <Button size="sm" variant="ghost" type="submit">Ablehnen</Button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">Keine Nutzer gefunden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && <a href={`/admin/users?kyc=${filterKyc}&page=${page - 1}`} className="rounded border border-[var(--color-surface-border)] px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">← Zurück</a>}
          <span className="text-[var(--color-text-muted)]">Seite {page} / {totalPages}</span>
          {page < totalPages && <a href={`/admin/users?kyc=${filterKyc}&page=${page + 1}`} className="rounded border border-[var(--color-surface-border)] px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">Weiter →</a>}
        </nav>
      )}
    </section>
  );
}
