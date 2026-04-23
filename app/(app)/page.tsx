import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { getCurrentUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KycStatus } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const kycStatus: KycStatus = profile?.kyc_status ?? "unverified";

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Hallo {user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "Nutzer"}
        </h1>
        <p className="text-[var(--color-text-muted)]">
          Willkommen zurück. Dein Verifizierungsstatus und die nächsten Schritte findest du unten.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Identitätsprüfung</CardTitle>
              <CardDescription>Pflicht vor Inseraten & Auszahlungen.</CardDescription>
            </div>
            <KycStatusBadge status={kycStatus} />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {kycStatus === "approved" &&
                "Deine Identität wurde verifiziert. Du kannst Inserate erstellen und Auszahlungen beantragen."}
              {kycStatus === "pending" &&
                "Dein Antrag wird geprüft. Das dauert in der Regel wenige Minuten."}
              {kycStatus === "rejected" &&
                "Dein Antrag wurde abgelehnt. Bitte starte die Prüfung erneut."}
              {kycStatus === "expired" &&
                "Dein Antrag ist abgelaufen. Bitte verifiziere dich erneut."}
              {kycStatus === "unverified" &&
                "Du bist noch nicht verifiziert. Starte die Prüfung in 2 Minuten."}
            </p>
            <Link
              href="/kyc"
              className={buttonVariants({
                variant: kycStatus === "approved" ? "secondary" : "primary",
                size: "sm",
              })}
            >
              {kycStatus === "approved" ? "Status ansehen" : "Jetzt verifizieren"}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marktplatz</CardTitle>
            <CardDescription>Deine Bounties & offene Stellen.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {kycStatus === "approved"
                ? "Leg deine erste Stellenausschreibung an oder verwalte bestehende Entwürfe."
                : "Sobald dein KYC freigegeben ist, kannst du Bounties veröffentlichen."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/bounties"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Marktplatz
              </Link>
              <Link
                href="/bounties/mine"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Meine Bounties
              </Link>
              {kycStatus === "approved" && (
                <Link
                  href="/bounties/new"
                  className={buttonVariants({ variant: "primary", size: "sm" })}
                >
                  Neue Bounty
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Empfehlungen</CardTitle>
            <CardDescription>Kandidat:innen empfehlen & Prämien sichern.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {kycStatus === "approved"
                ? "Finde passende Bounties im Marktplatz und empfiehl Kandidat:innen."
                : "Nach erfolgreicher KYC-Prüfung kannst du Empfehlungen abgeben."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/referrals/mine"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Meine Empfehlungen
              </Link>
              <Link
                href="/bounties"
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                Bounties entdecken
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payouts (Phase 5)</CardTitle>
            <CardDescription>Auszahlungen via Stripe Connect.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-muted)]">
              Verfügbar nach erfolgreicher KYC-Verifizierung.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
