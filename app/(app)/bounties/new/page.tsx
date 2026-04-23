import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { getCurrentUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KycStatus } from "@/lib/supabase/types";
import { BountyForm } from "./bounty-form";

export const metadata: Metadata = {
  title: "Neue Bounty erstellen",
};

export default async function NewBountyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .maybeSingle();

  const kycStatus: KycStatus = profile?.kyc_status ?? "unverified";
  const canCreate = kycStatus === "approved";

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 space-y-2">
        <Link
          href="/bounties/mine"
          className="text-sm text-[var(--color-text-muted)] hover:underline"
        >
          ← Zurück zu meinen Bounties
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Neue Bounty erstellen
        </h1>
        <p className="text-[var(--color-text-muted)]">
          Beschreibe die Rolle, die du besetzen willst, und die Prämie für erfolgreiche
          Empfehlungen.
        </p>
      </header>

      {!canCreate ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>KYC erforderlich</CardTitle>
              <CardDescription>
                Zum Erstellen einer Bounty muss deine Identität verifiziert sein.
              </CardDescription>
            </div>
            <KycStatusBadge status={kycStatus} />
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {kycStatus === "pending"
                ? "Dein Antrag wird gerade geprüft. Sobald er freigegeben ist, kannst du hier Bounties anlegen."
                : "Starte die Verifizierung – das dauert in der Regel nur wenige Minuten."}
            </p>
            <Link href="/kyc" className={buttonVariants({ variant: "primary", size: "sm" })}>
              Zur KYC-Seite
            </Link>
          </CardContent>
        </Card>
      ) : (
        <BountyForm />
      )}
    </section>
  );
}
