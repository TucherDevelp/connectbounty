import type { Metadata } from "next";
import Link from "next/link";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/roles";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { KycStatus } from "@/lib/supabase/types";
import { StartKycButton } from "./start-button";
import { KycSimulator } from "./simulator";
import { KycWizardPanel } from "./wizard-panel";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_kyc_title" });
}

export default async function KycPage() {
  const user = await requireUser();

  const supabase = await getSupabaseServerClient();
  const sbAdmin = getSupabaseServiceRoleClient();

  const [{ data: profile }, { data: applicant }, { data: applicantRow }] = await Promise.all([
    supabase.from("profiles").select("kyc_status").eq("id", user.id).maybeSingle(),
    supabase
      .from("kyc_applicants")
      .select("applicant_id, level_name, status, reject_labels, reviewed_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Für den Wizard: DB-UUID (id) des Antrags abrufen
    sbAdmin
      .from("kyc_applicants")
      .select("id, applicant_id, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const status: KycStatus = profile?.kyc_status ?? "unverified";
  const isDev = process.env.NODE_ENV !== "production";
  const isMock = process.env.KYC_PROVIDER !== "ballerine";
  const isBallerine = process.env.KYC_PROVIDER === "ballerine";

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        title="Identitätsprüfung"
        description="Pflicht vor dem Erstellen von Inseraten und dem Empfangen von Auszahlungen."
        actions={<KycStatusBadge status={status} />}
      />

      {/* Fortschritts-Schritte */}
      <ol className="mb-8 flex gap-2 overflow-x-auto text-xs sm:gap-0">
        {(["unverified", "pending", "approved"] as const).map((step, i) => {
          const labels = ["Nicht geprüft", "In Prüfung", "Verifiziert"];
          const isDone =
            (step === "unverified" && ["pending", "approved"].includes(status)) ||
            (step === "pending" && status === "approved");
          const isCurrent = step === status || (step === "unverified" && (status === "rejected" || status === "expired"));
          return (
            <li key={step} className="flex items-center gap-2 sm:flex-1">
              <span
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isDone
                    ? "bg-[var(--color-success)] text-white"
                    : isCurrent
                      ? "bg-[var(--color-brand)] text-primary-foreground"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
                ].join(" ")}
              >
                {isDone ? <Check className="size-3.5" strokeWidth={2.75} aria-hidden /> : i + 1}
              </span>
              <span className={isCurrent ? "font-medium text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>
                {labels[i]}
              </span>
              {i < 2 && <span className="mx-2 hidden h-px flex-1 bg-[var(--color-surface-border)] sm:block" />}
            </li>
          );
        })}
      </ol>

      {status === "unverified" && (
        <Card>
          <CardHeader>
            <CardTitle>Verifizierung starten</CardTitle>
            <CardDescription>
              Halte einen gültigen Ausweis (Personalausweis oder Pass) bereit.
              Die Prüfung dauert in der Regel unter 3 Minuten.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="space-y-1.5 text-sm text-[var(--color-text-muted)]">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" strokeWidth={2.25} aria-hidden />
                Ausweis oder Reisepass fotografieren / hochladen
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" strokeWidth={2.25} aria-hidden />
                Selfie aufnehmen
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" strokeWidth={2.25} aria-hidden />
                Admin-Prüfung - Ergebnis per E-Mail
              </li>
            </ul>
            <div>
              <StartKycButton />
            </div>
          </CardContent>
        </Card>
      )}

      {status === "pending" && applicant && (
        <Card>
          <CardHeader>
            <CardTitle>Antrag wird geprüft</CardTitle>
            <CardDescription>
              Wir informieren dich per E-Mail, sobald das Ergebnis vorliegt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              Antrag-Referenz:{" "}
              <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs">
                {applicant.applicant_id}
              </code>
            </p>

            {/* Dokument-Upload, wenn noch keine Dokumente hochgeladen (nur non-Ballerine) */}
            {!isBallerine && applicantRow && (
              <KycWizardPanel applicantRowId={applicantRow.id} />
            )}

            {isBallerine && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Deine Dokumente wurden an den Prüfdienst weitergeleitet.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {status === "approved" && (
        <Card className="border-[var(--color-success)]/30 bg-[color-mix(in_oklab,var(--color-success)_6%,var(--color-surface-1))]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Identität verifiziert
              <Check className="size-5 shrink-0 text-[var(--color-success)]" strokeWidth={2.5} aria-hidden />
            </CardTitle>
            <CardDescription>
              Geprüft am{" "}
              {applicant?.reviewed_at
                ? new Date(applicant.reviewed_at).toLocaleDateString("de-DE")
                : "-"}
              . Du hast jetzt Zugriff auf alle Plattform-Funktionen.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/bounties/new" className={buttonVariants({ variant: "primary", size: "sm" })}>
              Bounty erstellen
            </Link>
            <Link href="/bounties" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Marktplatz entdecken
            </Link>
          </CardContent>
        </Card>
      )}

      {(status === "rejected" || status === "expired") && (
        <Card className="border-[var(--color-error)]/30">
          <CardHeader>
            <CardTitle>
              {status === "rejected" ? "Antrag abgelehnt" : "Antrag abgelaufen"}
            </CardTitle>
            <CardDescription>
              {status === "rejected"
                ? "Dein Antrag konnte nicht genehmigt werden. Bitte starte die Prüfung erneut."
                : "Die Gültigkeitsdauer des Antrags ist abgelaufen. Bitte verifiziere dich erneut."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {applicant?.reject_labels && applicant.reject_labels.length > 0 && (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3">
                <p className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">Ablehnungsgründe:</p>
                <ul className="space-y-1 text-sm text-[var(--color-error)]">
                  {applicant.reject_labels.map((l) => (
                    <li key={l} className="flex items-start gap-1.5"><span>•</span>{l}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <StartKycButton label="Erneut starten" />
            </div>
          </CardContent>
        </Card>
      )}

      {isDev && isMock && applicant && status === "pending" && !applicantRow && (
        <Card className="mt-6 border-dashed border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-foreground">Dev-Simulator</CardTitle>
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
