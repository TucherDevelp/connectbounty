import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AlertTriangle, Check } from "lucide-react";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getConnectAccountStatus } from "@/lib/stripe/connect";
import { getStripeClient } from "@/lib/stripe/client";
import { formatBonus, formatDate, formatLocaleForLang } from "@/lib/format";
import type { PayoutStatus } from "@/lib/supabase/types";
import { FintechPayoutMark } from "@/components/icons/fintech-payout-mark";
import { ConnectOnboardingCard } from "./onboarding-card";
import { RefreshStatusButton } from "./refresh-button";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_payouts_title" });
}
export const dynamic = "force-dynamic";

const STATUS_LABEL_KEY: Record<PayoutStatus, TranslationKey> = {
  pending: "payout_status_pending",
  processing: "payout_status_processing",
  paid: "payout_status_paid",
  failed: "payout_status_failed",
  cancelled: "payout_status_cancelled",
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
      .eq("inserent_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  let currentlyDue: string[] = [];
  if (
    connectStatus?.stripeAccountId &&
    (connectStatus.onboardingStatus === "restricted" || connectStatus.onboardingStatus === "onboarding")
  ) {
    try {
      const stripe = getStripeClient();
      const account = await stripe.accounts.retrieve(connectStatus.stripeAccountId);
      if (account.requirements?.currently_due) {
        currentlyDue = account.requirements.currently_due;
      }
    } catch {
      // Ignore stripe fetch error on load
    }
  }

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

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const locale = formatLocaleForLang(lang);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader title={t(lang, "payout_page_title")} description={t(lang, "payout_page_desc")} />

      {/* Flash-Messages */}
      {stripeParam === "return" && isStripeReady && (
        <div className="mb-6 flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          <Check className="mt-0.5 size-5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span>{t(lang, "payout_stripe_ok")}</span>
        </div>
      )}
      {stripeParam === "return" && !isStripeReady && (
        <div className="mb-6 flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span>{t(lang, "payout_stripe_incomplete")}</span>
        </div>
      )}
      {stripeParam === "refresh" && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-info)]/10 px-4 py-3 text-sm text-[var(--color-info)]">
          {t(lang, "payout_stripe_link_expired")}
        </div>
      )}
      {errorParam && (
        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          {t(lang, "payout_error_prefix")} {decodeURIComponent(errorParam)}
        </div>
      )}

      {/* Stripe Connect Onboarding */}
      <ConnectOnboardingCard connectStatus={connectStatus} />

      {/* Stats */}
      {(payouts?.length ?? 0) > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4">
            <p className="text-xs text-[var(--color-text-muted)]">{t(lang, "payout_stat_total")}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--color-success)]">
              {formatBonus(totalPaid, "EUR", locale)}
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4">
            <p className="text-xs text-[var(--color-text-muted)]">{t(lang, "payout_stat_pending")}</p>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--color-warning)]">
              {formatBonus(pendingAmount, "EUR", locale)}
            </p>
          </div>
        </div>
      )}

      {/* Status Card & Actions */}
      <div className="mt-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <ConnectOnboardingCard connectStatus={connectStatus} currentlyDue={currentlyDue} />
        </div>
        <div className="flex shrink-0 items-center justify-start sm:justify-end">
          {connectStatus?.stripeAccountId && (
            <RefreshStatusButton />
          )}
        </div>
      </div>

      {/* Payout-Liste */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            {t(lang, "payout_history_title")}
          </h2>
        </div>

        {(payouts?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-surface-border)] py-12 text-center">
            <div
              className="flex size-[4.25rem] items-center justify-center rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-2)] text-[var(--color-brand-400)] shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--color-text-primary)_6%,transparent)]"
              aria-hidden
            >
              <FintechPayoutMark className="size-11" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t(lang, "payout_empty_title")}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{t(lang, "payout_empty_desc")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-surface-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-surface-border)] bg-[var(--color-surface-2)]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)]">
                    {t(lang, "payout_col_amount")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)]">
                    {t(lang, "payout_col_status")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] hidden sm:table-cell">
                    {t(lang, "payout_col_transfer")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] hidden md:table-cell">
                    {t(lang, "payout_col_date")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-surface-border)]">
                {payouts?.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatBonus(Number(p.amount), p.currency.toUpperCase(), locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${STATUS_COLOR[p.status as PayoutStatus]}`}>
                        {t(lang, STATUS_LABEL_KEY[p.status as PayoutStatus])}
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
                        <span className="text-xs text-[var(--color-text-faint)]">-</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[var(--color-text-muted)] md:table-cell">
                      {p.paid_at ? formatDate(p.paid_at, locale) : formatDate(p.created_at, locale)}
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
          <CardTitle className="text-sm">{t(lang, "payout_how_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="space-y-1.5 text-xs">
            <p>{t(lang, "payout_how_1")}</p>
            <p>{t(lang, "payout_how_2")}</p>
            <p>{t(lang, "payout_how_3")}</p>
            <p>{t(lang, "payout_how_4")}</p>
          </CardDescription>
        </CardContent>
      </Card>
    </section>
  );
}
