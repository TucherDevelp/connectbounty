import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Hallo {user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "Nutzer"}
        </h1>
        <p className="text-[var(--color-text-muted)]">
          Phase 1 abgeschlossen: Auth steht. Marktplatz, KYC und Payments folgen in
          den nächsten Phasen.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>KYC (Phase 2)</CardTitle>
            <CardDescription>Identitätsprüfung via Sumsub.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-muted)]">
              Wird in Phase 2 freigeschaltet. Bis dahin hast du den Status
              „unverifiziert".
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marktplatz (Phase 3)</CardTitle>
            <CardDescription>Inserate für Job-Referrals.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-muted)]">
              Folgt in Phase 3, gemeinsam mit Such- und Filter-UX.
            </p>
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
