import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAnyRole } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { ReferralStatusBadge } from "@/components/referral/status-badge";
import { ResolveForm } from "./resolve-form";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_admin_disputes_title" });
}

export default async function AdminDisputesPage() {
  try {
    await requireAnyRole(["admin", "superadmin", "support"] as const);
  } catch {
    redirect("/");
  }

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const locale = lang === "de" ? "de-DE" : "en-US";

  const supabase = await getSupabaseServerClient();

  const { data: disputes } = await supabase
    .from("referral_disputes")
    .select(`
      id, reason, status, created_at, resolved_at, resolution, opened_by,
      bounty_referrals!referral_disputes_referral_id_fkey(
        id, status, candidate_name, candidate_email,
        bounties!bounty_referrals_bounty_id_fkey(id, title, bonus_amount, bonus_currency)
      )
    `)
    .order("created_at", { ascending: false });

  const openDisputes = disputes?.filter((d) => d.status === "open") ?? [];
  const closedDisputes = disputes?.filter((d) => d.status !== "open") ?? [];

  const statsDesc = t(lang, "admin_disputes_stats")
    .replace("{open}", String(openDisputes.length))
    .replace("{closed}", String(closedDisputes.length));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title={t(lang, "admin_disputes_page_title")} description={statsDesc} />

      {/* Offene Disputes */}
      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t(lang, "admin_disputes_open_heading")}
        </h2>
        {openDisputes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)]">{t(lang, "admin_disputes_empty")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {openDisputes.map((dispute) => {
              const referral = Array.isArray(dispute.bounty_referrals)
                ? dispute.bounty_referrals[0]
                : (dispute.bounty_referrals as {
                    id: string;
                    status: string;
                    candidate_name: string;
                    candidate_email: string;
                    bounties:
                      | { id: string; title: string; bonus_amount: number; bonus_currency: string }
                      | { id: string; title: string; bonus_amount: number; bonus_currency: string }[]
                      | null;
                  } | null);

              const bounty = Array.isArray(referral?.bounties)
                ? referral?.bounties[0]
                : (referral?.bounties as { id: string; title: string; bonus_amount: number; bonus_currency: string } | null);

              return (
                <li
                  key={dispute.id}
                  className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {bounty?.title ?? "–"}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Kandidat: {referral?.candidate_name} ({referral?.candidate_email})
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Eröffnet: {new Date(dispute.created_at).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {referral?.status && (
                        <ReferralStatusBadge status={referral.status as never} />
                      )}
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {bounty?.bonus_amount.toLocaleString(locale)} {bounty?.bonus_currency}
                      </span>
                    </div>
                  </div>

                  {/* Dispute-Grund */}
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-text-muted)]">
                    {dispute.reason}
                  </div>

                  {/* Auflösungs-Form */}
                  <ResolveForm disputeId={dispute.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Abgeschlossene Disputes */}
      {closedDisputes.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t(lang, "admin_disputes_closed_heading")}
          </h2>
          <ul className="flex flex-col gap-3">
            {closedDisputes.map((dispute) => (
              <li
                key={dispute.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] px-4 py-3 text-sm"
              >
                <span className="text-[var(--color-text-muted)]">
                  {dispute.id.slice(0, 8)}…
                </span>
                <span
                  className={
                    dispute.status === "resolved"
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-error)]"
                  }
                >
                  {dispute.status === "resolved"
                    ? t(lang, "admin_disputes_status_resolved")
                    : t(lang, "admin_disputes_status_rejected")}
                </span>
                <span className="text-xs text-[var(--color-text-faint)]">
                  {dispute.resolved_at
                    ? new Date(dispute.resolved_at).toLocaleDateString(locale)
                    : "–"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
