import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/roles";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { KycStatus } from "@/lib/supabase/types";
import { formatDate, formatLocaleForLang } from "@/lib/format";
import { StartKycButton } from "./start-button";
import { KycSimulator } from "./simulator";
import { KycWizardPanel } from "./wizard-panel";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_kyc_title" });
}

const KYC_STEP_LABEL_KEYS: readonly TranslationKey[] = [
  "kyc_step_unverified",
  "kyc_step_pending",
  "kyc_step_approved",
];

export default async function KycPage() {
  const user = await requireUser();

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const locale = formatLocaleForLang(lang);

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

  const approvedDescription = applicant?.reviewed_at
    ? t(lang, "kyc_approved_desc_reviewed").replace(
        "{date}",
        formatDate(applicant.reviewed_at, locale) ?? "–",
      )
    : t(lang, "kyc_approved_desc_no_date");

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        title={t(lang, "kyc_page_title")}
        description={t(lang, "kyc_page_desc")}
        actions={<KycStatusBadge status={status} />}
      />

      <ol className="mb-8 flex gap-2 overflow-x-auto text-xs sm:gap-0">
        {(["unverified", "pending", "approved"] as const).map((step, i) => {
          const isDone =
            (step === "unverified" && ["pending", "approved"].includes(status)) ||
            (step === "pending" && status === "approved");
          const isCurrent =
            step === status || (step === "unverified" && (status === "rejected" || status === "expired"));
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
              <span
                className={
                  isCurrent ? "font-medium text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"
                }
              >
                {t(lang, KYC_STEP_LABEL_KEYS[i]!)}
              </span>
              {i < 2 && <span className="mx-2 hidden h-px flex-1 bg-[var(--color-surface-border)] sm:block" />}
            </li>
          );
        })}
      </ol>

      {status === "unverified" && (
        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "kyc_start_title")}</CardTitle>
            <CardDescription>{t(lang, "kyc_start_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="space-y-1.5 text-sm text-[var(--color-text-muted)]">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" strokeWidth={2.25} aria-hidden />
                {t(lang, "kyc_start_li1")}
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" strokeWidth={2.25} aria-hidden />
                {t(lang, "kyc_start_li2")}
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" strokeWidth={2.25} aria-hidden />
                {t(lang, "kyc_start_li3")}
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
            <CardTitle>{t(lang, "kyc_pending_title")}</CardTitle>
            <CardDescription>{t(lang, "kyc_pending_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t(lang, "kyc_pending_ref")}{" "}
              <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs">
                {applicant.applicant_id}
              </code>
            </p>

            {!isBallerine && applicantRow && <KycWizardPanel applicantRowId={applicantRow.id} />}

            {isBallerine && (
              <p className="text-sm text-[var(--color-text-muted)]">{t(lang, "kyc_ballerine_forwarded")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {status === "approved" && (
        <Card className="border-[var(--color-success)]/30 bg-[color-mix(in_oklab,var(--color-success)_6%,var(--color-surface-1))]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t(lang, "kyc_approved_title")}
              <Check className="size-5 shrink-0 text-[var(--color-success)]" strokeWidth={2.5} aria-hidden />
            </CardTitle>
            <CardDescription>{approvedDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/bounties/new" className={buttonVariants({ variant: "primary", size: "sm" })}>
              {t(lang, "kyc_cta_create")}
            </Link>
            <Link href="/bounties" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              {t(lang, "kyc_cta_browse")}
            </Link>
          </CardContent>
        </Card>
      )}

      {(status === "rejected" || status === "expired") && (
        <Card className="border-[var(--color-error)]/30">
          <CardHeader>
            <CardTitle>
              {t(lang, status === "rejected" ? "kyc_rejected_title" : "kyc_expired_title")}
            </CardTitle>
            <CardDescription>
              {t(lang, status === "rejected" ? "kyc_rejected_desc" : "kyc_expired_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {applicant?.reject_labels && applicant.reject_labels.length > 0 && (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3">
                <p className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                  {t(lang, "kyc_reject_reasons")}
                </p>
                <ul className="space-y-1 text-sm text-[var(--color-error)]">
                  {applicant.reject_labels.map((l) => (
                    <li key={l} className="flex items-start gap-1.5">
                      <span>•</span>
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <StartKycButton labelKey="kyc_restart" />
            </div>
          </CardContent>
        </Card>
      )}

      {isDev && isMock && applicant && status === "pending" && !applicantRow && (
        <Card className="mt-6 border-dashed border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-foreground">{t(lang, "kyc_dev_sim_title")}</CardTitle>
            <CardDescription>{t(lang, "kyc_dev_sim_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <KycSimulator applicantId={applicant.applicant_id} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
