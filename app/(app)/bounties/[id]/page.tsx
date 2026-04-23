import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";
import { BountyStatusBadge } from "@/components/bounty/status-badge";
import { ReferralStatusBadge } from "@/components/referral/status-badge";
import { ReferralForm } from "@/components/referral/referral-form";
import { formatBonus, formatDate } from "@/lib/format";
import {
  getBountyById,
  listReferralsForBounty,
  type BountyDetail,
  type ReferralForBounty,
} from "@/lib/bounty/queries";
import { getCurrentUser, isKycApproved } from "@/lib/auth/roles";
import {
  cancelBountyAction,
  closeBountyAction,
  publishBountyAction,
} from "@/lib/bounty/actions";
import { updateReferralStatusAction } from "@/lib/referral/actions";
import type { ReferralStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const bounty = await getBountyById(id);
    if (!bounty) return { title: "Bounty nicht gefunden" };
    return {
      title: bounty.title,
      description: bounty.description.slice(0, 160),
    };
  } catch {
    return { title: "Bounty" };
  }
}

// ── Hilfs-UI ──────────────────────────────────────────────────────────────

const ALLOWED_NEXT_STATUSES: Record<ReferralStatus, ReferralStatus[]> = {
  pending_review: [],
  submitted: ["contacted", "rejected"],
  contacted: ["interviewing", "rejected"],
  interviewing: ["hired", "rejected"],
  hired: ["paid"],
  paid: [],
  rejected: [],
  withdrawn: [],
};

const STATUS_ACTION_LABEL: Record<ReferralStatus, string> = {
  pending_review: "",
  contacted: "Kontaktiert markieren",
  interviewing: "In Interview setzen",
  hired: "Als eingestellt markieren",
  paid: "Als ausgezahlt markieren",
  rejected: "Ablehnen",
  submitted: "",
  withdrawn: "",
};

function ReferralRow({
  referral,
  canManage,
}: {
  referral: ReferralForBounty;
  canManage: boolean;
}) {
  const next = ALLOWED_NEXT_STATUSES[referral.status];
  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {referral.candidate_name}
          </p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            {referral.candidate_email}
          </p>
          {referral.candidate_contact && (
            <p className="mt-0.5 truncate text-xs text-[var(--color-text-faint)]">
              {referral.candidate_contact}
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--color-text-faint)]">
            Empfohlen von{" "}
            <span className="font-medium text-[var(--color-text-muted)]">
              {referral.referrer_display_name ?? "Unbekannt"}
            </span>{" "}
            · {formatDate(referral.created_at)}
          </p>
        </div>
        <ReferralStatusBadge status={referral.status} />
      </div>

      {referral.message && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">
          {referral.message}
        </p>
      )}

      {canManage && next.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {next.map((target) => (
            <form key={target} action={updateReferralStatusAction}>
              <input type="hidden" name="id" value={referral.id} />
              <input type="hidden" name="status" value={target} />
              <Button
                type="submit"
                size="sm"
                variant={target === "rejected" ? "ghost" : "secondary"}
              >
                {STATUS_ACTION_LABEL[target]}
              </Button>
            </form>
          ))}
        </div>
      )}
    </li>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function BountyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  let bounty: BountyDetail | null = null;
  try {
    bounty = await getBountyById(id);
  } catch {
    bounty = null;
  }
  if (!bounty) notFound();

  const user = await getCurrentUser();
  const isOwner = user?.id === bounty.owner_id;
  const kycOk = user ? await isKycApproved() : false;

  const expired =
    bounty.expires_at !== null && new Date(bounty.expires_at) < new Date();
  const canReceiveReferrals = bounty.status === "open" && !expired && !isOwner;

  let referrals: ReferralForBounty[] = [];
  if (isOwner) {
    try {
      referrals = await listReferralsForBounty(bounty.id);
    } catch {
      referrals = [];
    }
  }

  const statusUpdated = typeof sp.status_updated === "string" ? sp.status_updated : null;
  const err = typeof sp.error === "string" ? sp.error : null;

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-4 text-xs text-[var(--color-text-muted)]">
        <Link href="/bounties" className="hover:text-[var(--color-text-primary)]">
          ← Zurück zum Marktplatz
        </Link>
      </nav>

      {statusUpdated && (
        <div className="mb-4">
          <FormAlert variant="success">Empfehlungsstatus aktualisiert.</FormAlert>
        </div>
      )}
      {err && (
        <div className="mb-4">
          <FormAlert>
            {err === "status_update_failed"
              ? "Statusänderung nicht möglich – bitte Übergang prüfen."
              : "Aktion fehlgeschlagen."}
          </FormAlert>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{bounty.title}</CardTitle>
            <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold text-[var(--color-text-primary)]">
                {formatBonus(Number(bounty.bonus_amount), bounty.bonus_currency)}
              </span>
              {bounty.location && <span>· {bounty.location}</span>}
              {bounty.industry && <span>· {bounty.industry}</span>}
              <span>· von {bounty.owner_display_name ?? "Unbekannt"}</span>
              {bounty.published_at && (
                <span>· veröffentlicht {formatDate(bounty.published_at)}</span>
              )}
              {bounty.expires_at && (
                <span>· läuft ab {formatDate(bounty.expires_at)}</span>
              )}
            </CardDescription>
          </div>
          <BountyStatusBadge status={expired ? "expired" : bounty.status} />
        </CardHeader>
        <CardContent className="gap-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
            {bounty.description}
          </p>
          {bounty.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {bounty.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}

          {isOwner && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--color-surface-border)] pt-4">
              {bounty.status === "draft" && (
                <form action={publishBountyAction}>
                  <input type="hidden" name="id" value={bounty.id} />
                  <Button type="submit" size="sm">
                    Veröffentlichen
                  </Button>
                </form>
              )}
              {bounty.status === "open" && (
                <form action={closeBountyAction}>
                  <input type="hidden" name="id" value={bounty.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Schließen
                  </Button>
                </form>
              )}
              {(bounty.status === "draft" || bounty.status === "open") && (
                <form action={cancelBountyAction}>
                  <input type="hidden" name="id" value={bounty.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Stornieren
                  </Button>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owner-Sicht: eingehende Empfehlungen */}
      {isOwner && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Eingegangene Empfehlungen
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">
              {referrals.length}
            </span>
          </div>
          {referrals.length > 0 ? (
            <ul className="grid gap-3">
              {referrals.map((r) => (
                <ReferralRow key={r.id} referral={r} canManage />
              ))}
            </ul>
          ) : (
            <Card>
              <CardContent className="py-6 text-sm text-[var(--color-text-muted)]">
                Noch keine Empfehlungen. Sobald Nutzer:innen eine Empfehlung
                absenden, erscheint sie hier.
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Nicht-Owner: Empfehlungsformular */}
      {!isOwner && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">
            Kandidat:in empfehlen
          </h2>
          {!user ? (
            <Card>
              <CardContent className="py-6 text-sm text-[var(--color-text-muted)]">
                <Link
                  href={`/login?redirectTo=/bounties/${bounty.id}`}
                  className="text-[var(--color-brand)] underline underline-offset-4"
                >
                  Melde dich an
                </Link>
                , um eine Empfehlung abzugeben.
              </CardContent>
            </Card>
          ) : !canReceiveReferrals ? (
            <Card>
              <CardContent className="py-6 text-sm text-[var(--color-text-muted)]">
                Diese Bounty nimmt derzeit keine neuen Empfehlungen an.
              </CardContent>
            </Card>
          ) : !kycOk ? (
            <Card>
              <CardHeader>
                <CardTitle>KYC erforderlich</CardTitle>
                <CardDescription>
                  Um Empfehlungen abzugeben, musst du zuerst die
                  Identitätsprüfung abschließen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/kyc"
                  className={buttonVariants({ variant: "primary", size: "md" })}
                >
                  Zur KYC-Prüfung
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <ReferralForm bountyId={bounty.id} />
              </CardContent>
            </Card>
          )}
        </section>
      )}
    </section>
  );
}
