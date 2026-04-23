import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { requireUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KycStatus } from "@/lib/supabase/types";
import { StartKycButton } from "./start-button";
import { KycSimulator } from "./simulator";

export const metadata: Metadata = { title: "Identitätsprüfung" };

export default async function KycPage() {
  const user = await requireUser();

  const supabase = await getSupabaseServerClient();

  const [{ data: profile }, { data: applicant }] = await Promise.all([
    supabase.from("profiles").select("kyc_status").eq("id", user.id).maybeSingle(),
    supabase
      .from("kyc_applicants")
      .select("applicant_id, level_name, status, reject_labels, reviewed_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const status: KycStatus = profile?.kyc_status ?? "unverified";
  const isDev = process.env.NODE_ENV !== "production";
  const isMock = process.env.KYC_PROVIDER !== "ballerine";

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Identitätsprüfung
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Pflicht vor dem Erstellen von Inseraten und dem Empfangen von Auszahlungen.
          </p>
        </div>
        <KycStatusBadge status={status} />
      </header>

      {status === "unverified" && (
        <Card>
          <CardHeader>
            <CardTitle>Verifizierung starten</CardTitle>
            <CardDescription>
              Halte einen gültigen Ausweis bereit. Die Prüfung dauert in der Regel
              wenige Minuten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StartKycButton />
          </CardContent>
        </Card>
      )}

      {status === "pending" && applicant && (
        <Card>
          <CardHeader>
            <CardTitle>Antrag wird geprüft</CardTitle>
            <CardDescription>
              Antrag-ID: <code className="text-xs">{applicant.applicant_id}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-muted)]">
              Wir benachrichtigen dich, sobald die Prüfung abgeschlossen ist.
            </p>
          </CardContent>
        </Card>
      )}

      {status === "approved" && (
        <Card>
          <CardHeader>
            <CardTitle>Identität verifiziert</CardTitle>
            <CardDescription>
              Du kannst jetzt Inserate erstellen und Auszahlungen beantragen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-muted)]">
              Geprüft am{" "}
              {applicant?.reviewed_at
                ? new Date(applicant.reviewed_at).toLocaleDateString("de-DE")
                : "–"}
              .
            </p>
          </CardContent>
        </Card>
      )}

      {(status === "rejected" || status === "expired") && applicant && (
        <Card>
          <CardHeader>
            <CardTitle>
              {status === "rejected" ? "Antrag abgelehnt" : "Antrag abgelaufen"}
            </CardTitle>
            <CardDescription>
              Bitte starte die Verifizierung erneut.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {applicant.reject_labels && applicant.reject_labels.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-[var(--color-text-muted)]">
                {applicant.reject_labels.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            <StartKycButton label="Erneut starten" />
          </CardContent>
        </Card>
      )}

      {isDev && isMock && applicant && status === "pending" && (
        <Card className="mt-6 border-dashed border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-amber-200">Dev-Simulator</CardTitle>
            <CardDescription>
              Nur sichtbar im Mock-Modus und außerhalb von Production.
              Simuliert das Webhook-Event, das Ballerine später senden würde.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <KycSimulator applicantId={applicant.applicant_id} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
