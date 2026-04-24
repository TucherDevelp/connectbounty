import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { localizedMetadata } from "@/lib/i18n-metadata";
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

const TILES: { key: keyof Stats; label: string; color: string }[] = [
  { key: "bounties_open", label: "Offene Bounties", color: "text-[var(--color-success)]" },
  { key: "bounties_draft", label: "Entwürfe", color: "text-[var(--color-text-muted)]" },
  { key: "bounties_expired", label: "Abgelaufen", color: "text-[var(--color-warning)]" },
  { key: "referrals_submitted", label: "Neue Empfehlungen", color: "text-[var(--color-brand)]" },
  { key: "referrals_hired", label: "Eingestellt (offen)", color: "text-[var(--color-success)]" },
  { key: "payouts_pending", label: "Payouts ausstehend", color: "text-[var(--color-warning)]" },
  { key: "users_unverified", label: "Nicht verifiziert", color: "text-[var(--color-error)]" },
  { key: "users_approved", label: "KYC approved", color: "text-[var(--color-success)]" },
];

export default async function AdminDashboard() {
  // Normaler User-Client: admin_stats() prüft intern is_admin() via auth.uid().
  // Service-Role hat keine User-Session → Rollencheck schlägt fehl.
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc("admin_stats");

  const stats = (error ? null : (data as Json as Stats)) ?? null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <PageHeader title="Admin-Dashboard" description="Echtzeit-Überblick über Plattformaktivität." />

      {error && (
        <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          Fehler beim Laden der Stats: {error.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((t) => (
          <Card key={t.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--color-text-muted)]">
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${t.color}`}>
                {stats ? stats[t.key] : "-"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { href: "/admin/bounties", label: "Bounties verwalten", desc: "Moderieren, schließen, Entwürfe löschen" },
          { href: "/admin/users", label: "Nutzer & KYC", desc: "KYC-Status setzen, Rollen vergeben" },
          { href: "/admin/referrals", label: "Empfehlungen", desc: "Status überwachen, Auszahlungen anstoßen" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="group rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5 transition-all hover:border-[var(--color-brand-600)/50] hover:bg-[var(--color-surface-hover)]"
          >
            <p className="flex items-center gap-1.5 font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand)]">
              {link.label}
              <ArrowRight className="size-4 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{link.desc}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
