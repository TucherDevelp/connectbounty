import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";
import { BountyStatusBadge } from "@/components/bounty/status-badge";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { BountyStatus } from "@/lib/supabase/types";
import { formatBonus, formatDate } from "@/lib/format";
import {
  cancelBountyAction,
  closeBountyAction,
  deleteBountyAction,
  publishBountyAction,
} from "@/lib/bounty/actions";

export const metadata: Metadata = {
  title: "Meine Bounties",
};

// Lesbare Flash-Messages für Redirect-Query-Parameter (?created=, ?error=…).
const OK_MESSAGES: Record<string, string> = {
  created: "Bounty als Entwurf gespeichert.",
  pending: "Bounty eingereicht – wird in Kürze vom Admin geprüft und freigegeben.",
  closed: "Bounty geschlossen.",
  cancelled: "Bounty storniert.",
  deleted: "Bounty gelöscht.",
};
const ERROR_MESSAGES: Record<string, string> = {
  invalid_id: "Ungültige Bounty-ID.",
  kyc_required: "Du musst zuerst die KYC-Prüfung abschließen.",
  publish_failed: "Veröffentlichen fehlgeschlagen.",
  close_failed: "Schließen fehlgeschlagen.",
  cancel_failed: "Stornieren fehlgeschlagen.",
  delete_failed: "Löschen fehlgeschlagen.",
};

export default async function MyBountiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const okKey = Object.keys(OK_MESSAGES).find((k) => typeof sp[k] === "string");
  const errorKey = typeof sp.error === "string" ? sp.error : null;

  const supabase = await getSupabaseServerClient();
  const { data: bounties, error } = await supabase
    .from("bounties")
    .select(
      "id, title, description, bonus_amount, bonus_currency, status, location, industry, tags, expires_at, published_at, created_at",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-12">
        <FormAlert>Bounties konnten nicht geladen werden. Bitte später erneut versuchen.</FormAlert>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        title="Meine Bounties"
        description="Entwürfe, aktive Stellen und geschlossene Ausschreibungen."
        actions={
          <Link href="/bounties/new" className={buttonVariants({ variant: "primary", size: "md" })}>
            Neue Bounty
          </Link>
        }
      />

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

      {bounties && bounties.length > 0 ? (
        <ul className="grid gap-4">
          {bounties.map((b) => {
            const status = b.status as BountyStatus;
            const expires = formatDate(b.expires_at);
            const published = formatDate(b.published_at);
            return (
              <li key={b.id}>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{b.title}</CardTitle>
                      <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {formatBonus(Number(b.bonus_amount), b.bonus_currency)}
                        </span>
                        {b.location && <span>· {b.location}</span>}
                        {b.industry && <span>· {b.industry}</span>}
                        {published && <span>· Veröffentlicht {published}</span>}
                        {expires && <span>· Läuft ab {expires}</span>}
                      </CardDescription>
                    </div>
                    <BountyStatusBadge status={status} />
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <p className="line-clamp-3 text-sm text-[var(--color-text-muted)]">
                      {b.description}
                    </p>
                    {b.tags && b.tags.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {b.tags.map((tag: string) => (
                          <li
                            key={tag}
                            className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {status === "draft" && (
                        <>
                          <form action={publishBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" size="sm">
                              Zur Prüfung einreichen
                            </Button>
                          </form>
                          <form action={deleteBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" size="sm" variant="ghost">
                              Entwurf löschen
                            </Button>
                          </form>
                        </>
                      )}
                      {status === "pending_review" && (
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-[var(--color-warning)]">
                            Warte auf Admin-Freigabe.
                          </p>
                          <form action={cancelBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" size="sm" variant="ghost">
                              Zurückziehen
                            </Button>
                          </form>
                        </div>
                      )}
                      {status === "open" && (
                        <>
                          <form action={closeBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" size="sm" variant="secondary">
                              Schließen
                            </Button>
                          </form>
                          <form action={cancelBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" size="sm" variant="ghost">
                              Stornieren
                            </Button>
                          </form>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="Noch keine Bounties"
          description="Leg deine erste Stellenausschreibung mit Referral-Prämie an – in wenigen Minuten veröffentlicht."
          action={
            <Link href="/bounties/new" className={buttonVariants({ variant: "primary", size: "md" })}>
              Jetzt Bounty erstellen
            </Link>
          }
          icon={<span className="text-2xl">🎯</span>}
        />
      )}
    </section>
  );
}
