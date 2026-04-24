"use client";

import Link from "next/link";
import { ClipboardList, CreditCard, Handshake, Target } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { useLang } from "@/context/lang-context";
import type { KycStatus } from "@/lib/supabase/types";

function greetingKey(): "dash_greeting_morning" | "dash_greeting_day" | "dash_greeting_evening" {
  const h = new Date().getHours();
  if (h < 12) return "dash_greeting_morning";
  if (h < 18) return "dash_greeting_day";
  return "dash_greeting_evening";
}

export function DashboardView({
  displayName,
  kycStatus,
}: {
  displayName: string;
  kycStatus: KycStatus;
}) {
  const { t } = useLang();

  const kycTitleKey =
    kycStatus === "unverified"
      ? "dash_kyc_unverified"
      : kycStatus === "pending"
        ? "dash_kyc_pending"
        : kycStatus === "rejected"
          ? "dash_kyc_rejected"
          : kycStatus === "expired"
            ? "dash_kyc_expired"
            : "dash_kyc_unverified";

  const kycBannerBodyKey =
    kycStatus === "unverified"
      ? "dash_kyc_banner_unverified"
      : kycStatus === "pending"
        ? "dash_kyc_banner_pending"
        : kycStatus === "rejected" || kycStatus === "expired"
          ? "dash_kyc_banner_retry"
          : "dash_kyc_banner_unverified";

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">{t(greetingKey())},</p>
        <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tight">
          {displayName.trim() ? displayName : t("dash_user_fallback")}
        </h1>
      </header>

      {kycStatus !== "approved" && (
        <div className="mb-8 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 size-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">{t(kycTitleKey)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t(kycBannerBodyKey)}</p>
            </div>
          </div>
          <Link
            href="/kyc"
            className={buttonVariants({ variant: "primary", size: "sm" })}
            style={{ whiteSpace: "nowrap" }}
          >
            {kycStatus === "unverified" ? t("dash_kyc_cta_verify") : t("dash_kyc_cta_page")}
          </Link>
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dash_card_kyc_title")}</CardTitle>
            <KycStatusBadge status={kycStatus} />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CardDescription className="text-xs">
              {kycStatus === "approved" ? t("dash_card_kyc_ok") : t("dash_card_kyc_need")}
            </CardDescription>
            <Link
              href="/kyc"
              className={buttonVariants({
                variant: kycStatus === "approved" ? "secondary" : "primary",
                size: "sm",
              })}
            >
              {kycStatus === "approved" ? t("dash_card_kyc_view") : t("dash_card_kyc_start")}
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("dash_card_market_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CardDescription className="text-xs">{t("dash_card_market_desc")}</CardDescription>
            <div className="flex flex-wrap gap-2">
              <Link href="/bounties" className={buttonVariants({ variant: "primary", size: "sm" })}>
                {t("dash_discover")}
              </Link>
              {kycStatus === "approved" && (
                <Link href="/bounties/new" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  {t("dash_new_bounty")}
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("dash_card_ref_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CardDescription className="text-xs">{t("dash_card_ref_desc")}</CardDescription>
            <div className="flex flex-wrap gap-2">
              <Link href="/referrals/mine" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                {t("dash_my_refs")}
              </Link>
              <Link href="/bounties" className={buttonVariants({ variant: "primary", size: "sm" })}>
                {t("dash_refer_now")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border/50 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("dash_quick_title")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { href: "/bounties", labelKey: "dash_quick_all" as const, Icon: Target },
              { href: "/bounties/mine", labelKey: "dash_quick_mine" as const, Icon: ClipboardList },
              { href: "/referrals/mine", labelKey: "dash_quick_refs" as const, Icon: Handshake },
              { href: "/kyc", labelKey: "dash_quick_kyc" as const, Icon: CreditCard },
            ] as const
          ).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <item.Icon className="size-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
              {t(item.labelKey)}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
