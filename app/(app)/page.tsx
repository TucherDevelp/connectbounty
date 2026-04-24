import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { getCurrentUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KycStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dashboard – ConnectBounty" };
export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}


export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();

  const [{ data: profile }] = await Promise.all([
    supabase.from("profiles").select("kyc_status, display_name").eq("id", user?.id ?? "").maybeSingle(),
  ]);

  const kycStatus: KycStatus = profile?.kyc_status ?? "unverified";
  const displayName =
    profile?.display_name ??
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Nutzer:in";

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      {/* Begrüßung */}
      <header className="mb-8">
        <p className="text-sm text-[var(--color-text-muted)]">{greeting()},</p>
        <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tight">
          {displayName}
        </h1>
      </header>

      {/* KYC-Banner wenn nicht approved */}
      {kycStatus !== "approved" && (
        <div className="mb-8 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-brand-400)]/30 bg-[var(--color-brand-400)]/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">🪪</span>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {kycStatus === "unverified" && "Identitätsprüfung ausstehend"}
                {kycStatus === "pending" && "Prüfung läuft – bitte kurz warten"}
                {kycStatus === "rejected" && "Prüfung abgelehnt – erneut starten"}
                {kycStatus === "expired" && "Prüfung abgelaufen – neu starten"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {kycStatus === "unverified" &&
                  "KYC ist Pflicht, um Bounties zu erstellen und Prämien zu erhalten."}
                {kycStatus === "pending" &&
                  "Deine Dokumente werden geprüft. Du erhältst eine E-Mail sobald das Ergebnis vorliegt."}
                {(kycStatus === "rejected" || kycStatus === "expired") &&
                  "Starte die Prüfung erneut um alle Plattform-Funktionen nutzen zu können."}
              </p>
            </div>
          </div>
          <Link
            href="/kyc"
            className={buttonVariants({ variant: "primary", size: "sm" })}
            style={{ whiteSpace: "nowrap" }}
          >
            {kycStatus === "unverified" ? "Jetzt verifizieren" : "Zur KYC-Seite"}
          </Link>
        </div>
      )}

      {/* Aktionen */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="border-[var(--color-surface-border)]">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <CardTitle className="text-sm font-medium">Identitätsprüfung</CardTitle>
            <KycStatusBadge status={kycStatus} />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CardDescription className="text-xs">
              {kycStatus === "approved"
                ? "Deine Identität ist verifiziert. Alle Funktionen verfügbar."
                : "Für Bounties und Auszahlungen erforderlich."}
            </CardDescription>
            <Link
              href="/kyc"
              className={buttonVariants({
                variant: kycStatus === "approved" ? "secondary" : "primary",
                size: "sm",
              })}
            >
              {kycStatus === "approved" ? "Status ansehen" : "Starten"}
            </Link>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-surface-border)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Marktplatz</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CardDescription className="text-xs">
              Offene Stellen entdecken und Kandidat:innen empfehlen.
            </CardDescription>
            <div className="flex flex-wrap gap-2">
              <Link href="/bounties" className={buttonVariants({ variant: "primary", size: "sm" })}>
                Entdecken
              </Link>
              {kycStatus === "approved" && (
                <Link href="/bounties/new" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  + Bounty
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-surface-border)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Empfehlungen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CardDescription className="text-xs">
              Kandidat:innen empfehlen und Prämien sichern.
            </CardDescription>
            <div className="flex flex-wrap gap-2">
              <Link href="/referrals/mine" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Meine
              </Link>
              <Link href="/bounties" className={buttonVariants({ variant: "primary", size: "sm" })}>
                Jetzt empfehlen
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Schnellzugriff
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/bounties", label: "Alle Bounties", icon: "🎯" },
            { href: "/bounties/mine", label: "Meine Bounties", icon: "📋" },
            { href: "/referrals/mine", label: "Meine Empfehlungen", icon: "🤝" },
            { href: "/kyc", label: "KYC-Status", icon: "🪪" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
