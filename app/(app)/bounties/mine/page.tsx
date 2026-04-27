import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
import { Target } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";
import { BountyStatusBadge } from "@/components/bounty/status-badge";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { BountyStatus } from "@/lib/supabase/types";
import { formatBonus, formatDate, formatLocaleForLang } from "@/lib/format";
import {
  cancelBountyAction,
  closeBountyAction,
  deleteBountyAction,
  publishBountyAction,
} from "@/lib/bounty/actions";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_bounties_mine_title" });
}

const OK_MESSAGE_KEYS: Record<string, TranslationKey> = {
  created: "bounty_mine_ok_created",
  pending: "bounty_mine_ok_pending",
  closed: "bounty_mine_ok_closed",
  cancelled: "bounty_mine_ok_cancelled",
  deleted: "bounty_mine_ok_deleted",
};
const ERROR_MESSAGE_KEYS: Record<string, TranslationKey> = {
  invalid_id: "bounty_mine_err_invalid_id",
  kyc_required: "bounty_mine_err_kyc_required",
  publish_failed: "bounty_mine_err_publish_failed",
  close_failed: "bounty_mine_err_close_failed",
  cancel_failed: "bounty_mine_err_cancel_failed",
  delete_failed: "bounty_mine_err_delete_failed",
};

export default async function MyBountiesPage({
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
        <FormAlert>{t(lang, "bounty_mine_load_error")}</FormAlert>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        title={t(lang, "bounty_mine_title")}
        description={t(lang, "bounty_mine_desc")}
        actions={
          <Link href="/bounties/new" className={buttonVariants({ variant: "primary", size: "md" })}>
            {t(lang, "bounty_mine_new")}
          </Link>
        }
      />

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

      {bounties && bounties.length > 0 ? (
        <ul className="grid gap-4">
          {bounties.map((b) => {
            const status = b.status as BountyStatus;
            const expires = formatDate(b.expires_at, locale);
            const published = formatDate(b.published_at, locale);
            return (
              <li key={b.id}>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{b.title}</CardTitle>
                      <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {formatBonus(Number(b.bonus_amount), b.bonus_currency, locale)}
                        </span>
                        {b.location && <span>· {b.location}</span>}
                        {b.industry && <span>· {b.industry}</span>}
                        {published && (
                          <span>
                            · {t(lang, "bounty_mine_published").replace("{date}", published)}
                          </span>
                        )}
                        {expires && (
                          <span>· {t(lang, "bounty_mine_expires").replace("{date}", expires)}</span>
                        )}
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
                              {t(lang, "bounty_mine_submit_review")}
                            </Button>
                          </form>
                          <form action={deleteBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" size="sm" variant="ghost">
                              {t(lang, "bounty_mine_delete_draft")}
                            </Button>
                          </form>
                        </>
                      )}
                      {status === "pending_review" && (
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-[var(--color-warning)]">
                            {t(lang, "bounty_mine_wait_admin")}
                          </p>
                          <form action={cancelBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" size="sm" variant="ghost">
                              {t(lang, "bounty_mine_withdraw")}
                            </Button>
                          </form>
                        </div>
                      )}
                      {status === "open" && (
                        <>
                          <form action={closeBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" size="sm" variant="secondary">
                              {t(lang, "bounty_mine_close")}
                            </Button>
                          </form>
                          <form action={cancelBountyAction}>
                            <input type="hidden" name="id" value={b.id} />
                            <Button type="submit" size="sm" variant="ghost">
                              {t(lang, "bounty_mine_cancel")}
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
          title={t(lang, "bounty_mine_empty_title")}
          description={t(lang, "bounty_mine_empty_desc")}
          action={
            <Link href="/bounties/new" className={buttonVariants({ variant: "primary", size: "md" })}>
              {t(lang, "bounty_mine_empty_cta")}
            </Link>
          }
          icon={<Target className="size-10 text-muted-foreground" strokeWidth={1.5} aria-hidden />}
        />
      )}
    </section>
  );
}
