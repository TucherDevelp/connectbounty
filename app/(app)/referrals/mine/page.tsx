import type { Metadata } from "next";
import { cookies } from "next/headers";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
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
import { formatBonus, formatDate, formatLocaleForLang } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth/roles";
import { listMyReferrals } from "@/lib/bounty/queries";
import { withdrawReferralAction } from "@/lib/referral/actions";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_referrals_mine_title" });
}
export const dynamic = "force-dynamic";

const OK_MESSAGE_KEYS: Record<string, TranslationKey> = {
  submitted: "referrals_mine_ok_submitted",
  withdrawn: "referrals_mine_ok_withdrawn",
};
const ERROR_MESSAGE_KEYS: Record<string, TranslationKey> = {
  invalid_id: "referrals_mine_err_invalid_id",
  withdraw_failed: "referrals_mine_err_withdraw_failed",
};

export default async function MyReferralsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const okKey = Object.keys(OK_MESSAGE_KEYS).find((k) => typeof sp[k] === "string");
  const errorKey = typeof sp.error === "string" ? sp.error : null;

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const locale = formatLocaleForLang(lang);

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
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t(lang, "referrals_mine_title")}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">{t(lang, "referrals_mine_subtitle")}</p>
        </div>
        <Link href="/bounties" className={buttonVariants({ variant: "secondary", size: "md" })}>
          {t(lang, "referrals_mine_marketplace")}
        </Link>
      </header>

      {okKey && OK_MESSAGE_KEYS[okKey] && (
        <div className="mb-6">
          <FormAlert variant="success">{t(lang, OK_MESSAGE_KEYS[okKey])}</FormAlert>
        </div>
      )}
      {errorKey && (
        <div className="mb-6">
          <FormAlert>
            {ERROR_MESSAGE_KEYS[errorKey]
              ? t(lang, ERROR_MESSAGE_KEYS[errorKey])
              : t(lang, "error_unknown")}
          </FormAlert>
        </div>
      )}
      {failed && (
        <div className="mb-6">
          <FormAlert>{t(lang, "referrals_mine_load_error")}</FormAlert>
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
                        <span>
                          {t(lang, "referrals_mine_candidate")} {r.candidate_name}
                        </span>
                        <span>
                          · {t(lang, "referrals_mine_bonus")}{" "}
                          {formatBonus(Number(r.bonus_amount), r.bonus_currency, locale)}
                        </span>
                        <span>
                          ·{" "}
                          {t(lang, "referrals_mine_submitted_on").replace(
                            "{date}",
                            formatDate(r.created_at, locale) ?? "–",
                          )}
                        </span>
                      </CardDescription>
                    </div>
                    <ReferralStatusBadge status={r.status} />
                  </CardHeader>
                  {canWithdraw && (
                    <CardContent>
                      <form action={withdrawReferralAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          {t(lang, "referrals_mine_withdraw")}
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
              <CardTitle>{t(lang, "referrals_mine_empty_title")}</CardTitle>
              <CardDescription>{t(lang, "referrals_mine_empty_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/bounties" className={buttonVariants({ variant: "primary", size: "md" })}>
                {t(lang, "referrals_mine_empty_cta")}
              </Link>
            </CardContent>
          </Card>
        )
      )}
    </section>
  );
}
