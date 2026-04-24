import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getConnectAccountStatus } from "@/lib/stripe/connect";
import { formatBonus, formatDate } from "@/lib/format";
import type { PayoutStatus } from "@/lib/supabase/types";
import { ConnectOnboardingCard } from "./onboarding-card";
import { RefreshStatusButton } from "./refresh-button";

export const metadata: Metadata = { title: "Auszahlungen" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending: "Ausstehend",
  processing: "In Bearbeitung",
  paid: "Ausgezahlt",
  failed: "Fehlgeschlagen",
  cancelled: "Storniert",
};

const STATUS_COLOR: Record<PayoutStatus, string> = {
  pending: "text-[var(--color-warning)]",
  processing: "text-[var(--color-info)]",
  paid: "text-[var(--color-success)]",
  failed: "text-[var(--color-error)]",
  cancelled: "text-[var(--color-text-faint)]",
};

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const supabase = await getSupabaseServerClient();

  const [connectStatus, { data: payouts }] = await Promise.all([
    getConnectAccountStatus(user.id).catch(() => null),
    supabase
      .from("payouts")
      .select(
        "id, amount, currency, status, stripe_transfer_id, stripe_error_code, created_at, paid_at, referral_id",
      )
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const totalPaid =
    payouts
      ?.filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const pendingAmount =
    payouts
      ?.filter((p) => p.status === "pending" || p.status === "processing")
      .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const isStripeReady = !!connectStatus?.payoutsEnabled;
  const stripeParam = sp.stripe;
  const errorParam = sp.error;

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader title="Auszahlungen" description="Deine Prämien-Auszahlungen via Stripe Connect." />

      {/* Flash-Messages */}
      {stripeParam === "return" && isStripeReady && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          ✓ Stripe-Konto erfolgreich verbunden! Du kannst jetzt Auszahlungen empfangen.
        </div>
      )}
      {stripeParam === "return" && !isStripeReady && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">
          ⚠ Das Onboarding wurde gestartet, aber noch nicht vollständig abgeschlossen. Bitte
          vollende alle Schritte.
        </div>
      )}
      {stripeParam === "refresh" && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-info)]/10 px-4 py-3 text-sm text-[var(--color-info)]">
          Der Onboarding-Link ist abgelaufen. Bitte starte das Onboarding erneut.
        </div>
      )}
      {errorParam && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          Fehler: {decodeURIComponent(errorParam)}
        </div>
      )}

      {/* Stripe Connect Onboarding */}
      <ConnectOnboardingCard connectStatus={connectStatus} />

      {/* Stats */}
      {(payouts?.length ?? 0) > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4">
            <p className="text-xs text-[var(--color-text-muted)]">Gesamt ausgezahlt</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--color-success)]">
              {formatBonus(totalPaid, "EUR")}
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4">
            <p className="text-xs text-[var(--color-text-muted)]">Ausstehend</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--color-warning)]">
              {formatBonus(pendingAmount, "EUR")}
            </p>
          </div>
        </div>
      )}

      {/* Payout-Liste */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            Auszahlungs-Verlauf
          </h2>
          {connectStatus?.stripeAccountId && (
            <RefreshStatusButton />
          )}
        </div>

        {(payouts?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-surface-border)] py-12 text-center">
            <span className="text-3xl">💸</span>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Noch keine Auszahlungen
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Wenn ein Kandidat eingestellt wird, erscheint hier deine Prämie.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-surface-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-surface-border)] bg-[var(--color-surface-2)]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)]">Betrag</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] hidden sm:table-cell">Transfer-ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] hidden md:table-cell">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-surface-border)]">
                {payouts?.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatBonus(Number(p.amount), p.currency.toUpperCase())}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${STATUS_COLOR[p.status as PayoutStatus]}`}>
                        {STATUS_LABEL[p.status as PayoutStatus]}
                      </span>
                      {p.stripe_error_code && (
                        <span className="ml-2 text-xs text-[var(--color-error)]">
                          ({p.stripe_error_code})
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {p.stripe_transfer_id ? (
                        <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]">
                          {p.stripe_transfer_id.slice(0, 16)}…
                        </code>
                      ) : (
                        <span className="text-xs text-[var(--color-text-faint)]">–</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[var(--color-text-muted)] md:table-cell">
                      {p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info-Box */}
      <Card className="mt-6 border-[var(--color-surface-border)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Wie funktionieren Auszahlungen?</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="space-y-1.5 text-xs">
            <p>1. Du verbindest dein Bankkonto via Stripe Connect (einmalig).</p>
            <p>2. Wenn ein von dir empfohlener Kandidat eingestellt wird, legt der Admin die Prämie fest.</p>
            <p>3. Die Prämie (abzüglich Platform-Gebühr) wird an dein Stripe-Konto überwiesen.</p>
            <p>4. Stripe überträgt den Betrag auf dein Bankkonto gemäß deinen Auszahlungseinstellungen.</p>
          </CardDescription>
        </CardContent>
      </Card>
    </section>
  );
}
