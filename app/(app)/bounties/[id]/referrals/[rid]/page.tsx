import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { ReferralStatusBadge } from "@/components/referral/status-badge";
import { ThreeStageProgress } from "@/components/referral/three-stage-progress";
import {
  ConfirmClaimButton,
  ConfirmDataForwardedButton,
  RejectButton,
  OpenDisputeButton,
} from "@/components/referral/confirmation-buttons";
import type { ReferralStatus } from "@/lib/supabase/types";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; rid: string }>;
}): Promise<Metadata> {
  const { rid } = await params;
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  return { title: `${t(lang, "meta_referral_prefix")} ${rid.slice(0, 8)}` };
}

export default async function ReferralDetailPage({
  params,
}: {
  params: Promise<{ id: string; rid: string }>;
}) {
  const { id: bountyId, rid } = await params;

  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");

  const supabase = await getSupabaseServerClient();

  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select(`
      id, status, candidate_name, candidate_email,
      hire_proof_uploaded_at, claim_confirmed_at,
      payout_account_confirmed_at, data_forwarded_at,
      all_confirmations_done, rejection_reason, rejection_stage,
      rejection_at, company_name, company_billing_email,
      payment_window_until, created_at,
      bounties!bounty_referrals_bounty_id_fkey(id, owner_id, title, bonus_amount, bonus_currency)
    `)
    .eq("id", rid)
    .eq("bounty_id", bountyId)
    .maybeSingle();

  if (!referral) notFound();

  const bounty = Array.isArray(referral.bounties)
    ? referral.bounties[0]
    : (referral.bounties as { id: string; owner_id: string; title: string; bonus_amount: number; bonus_currency: string } | null);

  if (!bounty) notFound();

  const isOwner = bounty.owner_id === user.id;
  const isCandidate = referral.candidate_name === user.email || true; // kandidat_user_id-check via RLS
  const status = referral.status as ReferralStatus;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-2">
        <Link href={`/bounties/${bountyId}`} className="text-xs text-[var(--color-text-muted)] underline">
          ← {bounty.title}
        </Link>
      </div>

      <PageHeader
        title="Referral-Detail"
        description={`Kandidat: ${referral.candidate_name} · ${referral.candidate_email}`}
      />

      <div className="mt-6 flex items-center gap-3">
        <ReferralStatusBadge status={status} />
        <span className="text-xs text-[var(--color-text-faint)]">
          Prämie: {bounty.bonus_amount.toLocaleString("de-DE")} {bounty.bonus_currency}
        </span>
      </div>

      {/* 4-Step-Progress nur für new flow */}
      {[
        "awaiting_hire_proof", "awaiting_claim", "awaiting_payout_account",
        "awaiting_data_forwarding", "invoice_pending", "invoice_paid", "paid",
      ].includes(status) && (
        <div className="mt-8">
          <ThreeStageProgress
            status={status}
            hireProofUploaded={Boolean(referral.hire_proof_uploaded_at)}
            claimConfirmed={Boolean(referral.claim_confirmed_at)}
            payoutAccountConfirmed={Boolean(referral.payout_account_confirmed_at)}
            dataForwarded={Boolean(referral.data_forwarded_at)}
          />
        </div>
      )}

      {/* Zahlungsfenster-Hinweis */}
      {referral.payment_window_until && status === "invoice_pending" && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[color-mix(in_oklab,var(--color-warning)_8%,transparent)] p-4 text-sm">
          <strong className="text-[var(--color-warning)]">Zahlungsfenster:</strong>{" "}
          Rechnung muss bis{" "}
          <time dateTime={referral.payment_window_until}>
            {new Date(referral.payment_window_until).toLocaleDateString("de-DE")}
          </time>{" "}
          bezahlt werden.
        </div>
      )}

      {/* Firmendaten (nach Schritt 8) */}
      {referral.company_name && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Rechnungsempfänger</p>
          <p className="mt-1 font-medium text-[var(--color-text-primary)]">{referral.company_name}</p>
          {referral.company_billing_email && (
            <p className="text-sm text-[var(--color-text-muted)]">{referral.company_billing_email}</p>
          )}
        </div>
      )}

      {/* Ablehnung-Info */}
      {status === "rejected" && referral.rejection_reason && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[color-mix(in_oklab,var(--color-error)_6%,transparent)] p-4">
          <p className="text-xs font-medium text-[var(--color-error)] uppercase tracking-wide">
            Abgelehnt – Stufe: {referral.rejection_stage}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{referral.rejection_reason}</p>
          {referral.rejection_at && (
            <p className="mt-1 text-xs text-[var(--color-text-faint)]">
              {new Date(referral.rejection_at).toLocaleString("de-DE")}
            </p>
          )}
        </div>
      )}

      {/* ── Aktions-Bereich: Owner A ────────────────────────────────────── */}
      {isOwner && (
        <div className="mt-8 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Deine Aktionen</h2>

          {status === "awaiting_claim" && (
            <div className="flex flex-col gap-3">
              <ConfirmClaimButton referralId={rid} />
              <RejectButton referralId={rid} stage="claim" currentStatus={status} />
            </div>
          )}

          {status === "awaiting_payout_account" && (
            <div className="flex flex-col gap-3">
              <Link
                href={`/bounties/${bountyId}/referrals/${rid}/confirm-payout`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-400)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-300)]"
              >
                Firmendaten + Stripe-Konto angeben
                <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              </Link>
              <RejectButton referralId={rid} stage="payout_account" currentStatus={status} />
            </div>
          )}

          {status === "awaiting_data_forwarding" && (
            <div className="flex flex-col gap-3">
              <ConfirmDataForwardedButton referralId={rid} />
              <RejectButton referralId={rid} stage="data_forwarding" currentStatus={status} />
            </div>
          )}
        </div>
      )}

      {/* ── Aktions-Bereich: Kandidat B ─────────────────────────────────── */}
      {!isOwner && (
        <div className="mt-8 flex flex-col gap-4">
          {status === "awaiting_hire_proof" && (
            <Link
              href={`/referrals/${rid}/upload`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-400)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-300)]"
            >
              Nachweis hochladen
              <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            </Link>
          )}

          {status === "rejected" && (
            <OpenDisputeButton referralId={rid} />
          )}
        </div>
      )}
    </div>
  );
}
