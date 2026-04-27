import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Loader2 } from "lucide-react";
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
import {
  formatBonus,
  formatDate,
  formatLocaleForLang,
  type FormatLocale,
} from "@/lib/format";
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
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  try {
    const bounty = await getBountyById(id);
    if (!bounty) return { title: t(lang, "meta_bounty_not_found") };
    return {
      title: bounty.title,
      description: bounty.description.slice(0, 160),
    };
  } catch {
    return { title: t(lang, "meta_bounty_fallback") };
  }
}

// ── Hilfs-UI ──────────────────────────────────────────────────────────────

const ALLOWED_NEXT_STATUSES: Record<ReferralStatus, ReferralStatus[]> = {
  // Legacy-Flow
  pending_review: [],
  submitted: ["contacted", "rejected"],
  contacted: ["interviewing", "rejected"],
  interviewing: ["hired", "rejected"],
  hired: ["paid"],
  paid: [],
  rejected: [],
  withdrawn: [],
  // v7 - Three-stage confirmation flow (managed via dedicated confirmation actions)
  awaiting_hire_proof: [],
  awaiting_claim: [],
  awaiting_payout_account: [],
  awaiting_data_forwarding: [],
  invoice_pending: [],
  invoice_paid: [],
  disputed: [],
};

const STATUS_ACTION_KEY: Partial<Record<ReferralStatus, TranslationKey>> = {
  contacted: "referral_owner_action_contacted",
  interviewing: "referral_owner_action_interviewing",
  hired: "referral_owner_action_hired",
  paid: "referral_owner_action_paid",
  rejected: "referral_owner_action_reject",
};

function ReferralRow({
  referral,
  canManage,
  tr,
  locale,
}: {
  referral: ReferralForBounty;
  canManage: boolean;
  tr: (key: TranslationKey) => string;
  locale: FormatLocale;
}) {
  const next = ALLOWED_NEXT_STATUSES[referral.status];
  const referredDate = formatDate(referral.created_at, locale);
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
            {tr("bounty_detail_referred_meta")
              .replace("{name}", referral.referrer_display_name ?? tr("bounty_detail_unknown"))
              .replace("{date}", referredDate ?? "—")}
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
                {tr(STATUS_ACTION_KEY[target]!)}
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

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const locale = formatLocaleForLang(lang);
  const tr = (key: TranslationKey) => t(lang, key);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/bounties" className="hover:text-[var(--color-text-primary)] transition-colors">
          {tr("nav_marketplace")}
        </Link>
        <span>/</span>
        <span className="truncate max-w-[200px] text-[var(--color-text-primary)]">{bounty.title}</span>
      </nav>

      {/* Flash-Messages */}
      {statusUpdated && (
        <div className="mb-4">
          <FormAlert variant="success">{tr("bounty_detail_ref_updated")}</FormAlert>
        </div>
      )}
      {err && (
        <div className="mb-4">
          <FormAlert>
            {err === "status_update_failed"
              ? tr("bounty_detail_error_status_transition")
              : tr("bounty_detail_error_generic")}
          </FormAlert>
        </div>
      )}

      {/* pending_review Banner für Owner */}
      {isOwner && bounty.status === "pending_review" && (
        <div className="mb-5 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-4">
          <Loader2 className="mt-0.5 size-6 shrink-0 text-[var(--color-warning)]" strokeWidth={2} aria-hidden />
          <div>
            <p className="text-sm font-semibold text-[var(--color-warning)]">
              {tr("bounty_detail_pending_admin_title")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {tr("bounty_detail_pending_admin_body")}
            </p>
          </div>
        </div>
      )}

      {/* Hero-Card */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)]">
        {/* Hero-Header */}
        <div className="relative border-b border-[var(--color-surface-border)] bg-gradient-to-br from-[var(--color-surface-1)] to-[var(--color-surface-2)] px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
                {bounty.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-text-muted)]">
                {bounty.location && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                      <path d="M8 1a5 5 0 0 0-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
                    </svg>
                    {bounty.location}
                  </span>
                )}
                {bounty.industry && (
                  <span className="rounded-full border border-[var(--color-surface-border)] px-2 py-0.5 text-xs">
                    {bounty.industry}
                  </span>
                )}
                <span>
                  {tr("bounty_detail_by")}{" "}
                  <strong className="text-[var(--color-text-primary)]">
                    {bounty.owner_display_name ?? tr("bounty_detail_unknown")}
                  </strong>
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-faint)]">
                {bounty.published_at && (
                  <span>
                    {tr("bounty_mine_published").replace(
                      "{date}",
                      formatDate(bounty.published_at, locale) ?? "",
                    )}
                  </span>
                )}
                {bounty.expires_at && (
                  <span className={expired ? "text-[var(--color-error)]" : ""}>
                    ·{" "}
                    {tr("bounty_mine_expires").replace(
                      "{date}",
                      formatDate(bounty.expires_at, locale) ?? "",
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <BountyStatusBadge status={expired ? "expired" : bounty.status} />
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-faint)]">{tr("bounty_card_bonus")}</p>
                <p className="font-display text-3xl font-bold text-[var(--color-brand-400)]">
                  {formatBonus(Number(bounty.bonus_amount), bounty.bonus_currency, locale)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Beschreibung + Tags */}
        <div className="px-6 py-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
            {bounty.description}
          </p>

          {bounty.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {bounty.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-[var(--color-surface-border)] bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs text-[var(--color-text-muted)]"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}

          {/* Owner-Aktionen */}
          {isOwner && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--color-surface-border)] pt-5">
              {bounty.status === "draft" && (
                <form action={publishBountyAction}>
                  <input type="hidden" name="id" value={bounty.id} />
                  <Button type="submit" size="sm">
                    {tr("bounty_detail_publish")}
                  </Button>
                </form>
              )}
              {bounty.status === "open" && (
                <form action={closeBountyAction}>
                  <input type="hidden" name="id" value={bounty.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    {tr("bounty_mine_close")}
                  </Button>
                </form>
              )}
              {(bounty.status === "draft" || bounty.status === "open") && (
                <form action={cancelBountyAction}>
                  <input type="hidden" name="id" value={bounty.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    {tr("bounty_mine_cancel")}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Owner-Sicht: eingehende Empfehlungen */}
      {isOwner && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {tr("bounty_detail_referrals_heading")}
            </h2>
            <span className="rounded-full border border-[var(--color-surface-border)] bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
              {referrals.length}
            </span>
          </div>
          {referrals.length > 0 ? (
            <ul className="grid gap-3">
              {referrals.map((r) => (
                <ReferralRow key={r.id} referral={r} canManage tr={tr} locale={locale} />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-surface-border)] py-10 text-center">
              <span className="text-3xl">📭</span>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {tr("bounty_detail_no_referrals_title")}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {tr("bounty_detail_no_referrals_desc")}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Nicht-Owner: Empfehlungsformular */}
      {!isOwner && (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-semibold tracking-tight">
            {tr("bounty_detail_refer_heading")}
          </h2>
          {!user ? (
            <Card>
              <CardContent className="py-6 text-sm text-[var(--color-text-muted)]">
                <Link
                  href={`/login?redirectTo=/bounties/${bounty.id}`}
                  className="text-[var(--color-brand)] underline underline-offset-4"
                >
                  {tr("bounty_detail_refer_login")}
                </Link>
                {tr("bounty_detail_refer_suffix")}
              </CardContent>
            </Card>
          ) : !canReceiveReferrals ? (
            <Card>
              <CardContent className="py-6 text-sm text-[var(--color-text-muted)]">
                {tr("bounty_detail_not_accepting")}
              </CardContent>
            </Card>
          ) : !kycOk ? (
            <Card>
              <CardHeader>
                <CardTitle>{tr("bounty_new_kyc_title")}</CardTitle>
                <CardDescription>{tr("bounty_detail_refer_kyc_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/kyc"
                  className={buttonVariants({ variant: "primary", size: "md" })}
                >
                  {tr("bounty_new_kyc_cta")}
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
