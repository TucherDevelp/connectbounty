import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_admin_dashboard_title" });
}
export const dynamic = "force-dynamic";

type Stats = {
  bounties_open: number;
  bounties_draft: number;
  bounties_expired: number;
  referrals_submitted: number;
  referrals_hired: number;
  payouts_pending: number;
  users_unverified: number;
  users_approved: number;
};

const TILES: { key: keyof Stats; labelKey: TranslationKey; color: string }[] = [
  { key: "bounties_open", labelKey: "admin_stat_bounties_open", color: "text-[var(--color-success)]" },
  { key: "bounties_draft", labelKey: "admin_stat_bounties_draft", color: "text-[var(--color-text-muted)]" },
  { key: "bounties_expired", labelKey: "admin_stat_bounties_expired", color: "text-[var(--color-warning)]" },
  { key: "referrals_submitted", labelKey: "admin_stat_referrals_submitted", color: "text-[var(--color-brand)]" },
  { key: "referrals_hired", labelKey: "admin_stat_referrals_hired", color: "text-[var(--color-success)]" },
  { key: "payouts_pending", labelKey: "admin_stat_payouts_pending", color: "text-[var(--color-warning)]" },
  { key: "users_unverified", labelKey: "admin_stat_users_unverified", color: "text-[var(--color-error)]" },
  { key: "users_approved", labelKey: "admin_stat_users_approved", color: "text-[var(--color-success)]" },
];

const QUICK_LINKS: { href: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { href: "/admin/bounties", titleKey: "admin_quick_bounties_title", descKey: "admin_quick_bounties_desc" },
  { href: "/admin/users", titleKey: "admin_quick_users_title", descKey: "admin_quick_users_desc" },
  { href: "/admin/referrals", titleKey: "admin_quick_referrals_title", descKey: "admin_quick_referrals_desc" },
];

export default async function AdminDashboard() {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

  // Normaler User-Client: admin_stats() prüft intern is_admin() via auth.uid().
  // Service-Role hat keine User-Session → Rollencheck schlägt fehl.
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc("admin_stats");

  const stats = (error ? null : (data as Json as Stats)) ?? null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <PageHeader title={t(lang, "admin_dashboard_title")} description={t(lang, "admin_dashboard_desc")} />

      {error && (
        <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          {t(lang, "admin_dashboard_stats_error").replace("{message}", error.message)}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => (
          <Card key={tile.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--color-text-muted)]">
                {t(lang, tile.labelKey)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${tile.color}`}>
                {stats ? stats[tile.key] : "-"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="group rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5 transition-all hover:border-[var(--color-brand-600)/50] hover:bg-[var(--color-surface-hover)]"
          >
            <p className="flex items-center gap-1.5 font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand)]">
              {t(lang, link.titleKey)}
              <ArrowRight className="size-4 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t(lang, link.descKey)}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
