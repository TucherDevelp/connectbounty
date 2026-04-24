import type { Metadata } from "next";
import { localizedMetadata } from "@/lib/i18n-metadata";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";
import { ReferralStatusBadge } from "@/components/referral/status-badge";
import { formatBonus, formatDate } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth/roles";
import { listMyReferrals } from "@/lib/bounty/queries";
import { withdrawReferralAction } from "@/lib/referral/actions";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_referrals_mine_title" });
}
export const dynamic = "force-dynamic";

const OK_MESSAGES: Record<string, string> = {
  submitted: "Empfehlung erfolgreich abgegeben.",
  withdrawn: "Empfehlung zurückgezogen.",
};
const ERROR_MESSAGES: Record<string, string> = {
  invalid_id: "Ungültige Empfehlungs-ID.",
  withdraw_failed: "Empfehlung konnte nicht zurückgezogen werden.",
};

export default async function MyReferralsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const okKey = Object.keys(OK_MESSAGES).find((k) => typeof sp[k] === "string");
  const errorKey = typeof sp.error === "string" ? sp.error : null;

  let referrals: Awaited<ReturnType<typeof listMyReferrals>> = [];
  let failed = false;
  try {
    referrals = await listMyReferrals(user.id);
  } catch {
    failed = true;
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Meine Empfehlungen</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Überblick über alle von dir abgegebenen Empfehlungen.
          </p>
        </div>
        <Link href="/bounties" className={buttonVariants({ variant: "secondary", size: "md" })}>
          Marktplatz öffnen
        </Link>
      </header>

      {okKey && (
        <div className="mb-6">
          <FormAlert variant="success">{OK_MESSAGES[okKey]}</FormAlert>
        </div>
      )}
      {errorKey && (
        <div className="mb-6">
          <FormAlert>{ERROR_MESSAGES[errorKey] ?? "Unbekannter Fehler."}</FormAlert>
        </div>
      )}
      {failed && (
        <div className="mb-6">
          <FormAlert>Empfehlungen konnten nicht geladen werden. Bitte später erneut versuchen.</FormAlert>
        </div>
      )}

      {referrals.length > 0 ? (
        <ul className="grid gap-3">
          {referrals.map((r) => {
            const canWithdraw = ["pending_review", "submitted", "contacted", "interviewing"].includes(r.status);
            return (
              <li key={r.id}>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base">
                        <Link
                          href={`/bounties/${r.bounty_id}`}
                          className="hover:underline underline-offset-4"
                        >
                          {r.bounty_title}
                        </Link>
                      </CardTitle>
                      <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <span>Kandidat:in: {r.candidate_name}</span>
                        <span>
                          · Prämie: {formatBonus(Number(r.bonus_amount), r.bonus_currency)}
                        </span>
                        <span>· Abgegeben am {formatDate(r.created_at)}</span>
                      </CardDescription>
                    </div>
                    <ReferralStatusBadge status={r.status} />
                  </CardHeader>
                  {canWithdraw && (
                    <CardContent>
                      <form action={withdrawReferralAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Empfehlung zurückziehen
                        </Button>
                      </form>
                    </CardContent>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        !failed && (
          <Card>
            <CardHeader>
              <CardTitle>Noch keine Empfehlungen</CardTitle>
              <CardDescription>
                Stöbere im Marktplatz und empfehle passende Kandidat:innen, um dir die Prämie
                zu sichern.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/bounties" className={buttonVariants({ variant: "primary", size: "md" })}>
                Zum Marktplatz
              </Link>
            </CardContent>
          </Card>
        )
      )}
    </section>
  );
}
