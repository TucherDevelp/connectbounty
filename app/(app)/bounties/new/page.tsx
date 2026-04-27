import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { t } from "@/lib/i18n";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { KycStatusBadge } from "@/components/kyc/status-badge";
import { getCurrentUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KycStatus } from "@/lib/supabase/types";
import { BountyForm } from "./bounty-form";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_bounty_new_title" });
}

export default async function NewBountyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .maybeSingle();

  const kycStatus: KycStatus = profile?.kyc_status ?? "unverified";
  const canCreate = kycStatus === "approved";

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 space-y-2">
        <Link
          href="/bounties/mine"
          className="text-sm text-[var(--color-text-muted)] hover:underline"
        >
          {t(lang, "bounty_new_back")}
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {t(lang, "bounty_new_title")}
        </h1>
        <p className="text-[var(--color-text-muted)]">{t(lang, "bounty_new_intro")}</p>
      </header>

      {!canCreate ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{t(lang, "bounty_new_kyc_title")}</CardTitle>
              <CardDescription>{t(lang, "bounty_new_kyc_desc")}</CardDescription>
            </div>
            <KycStatusBadge status={kycStatus} />
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {kycStatus === "pending"
                ? t(lang, "bounty_new_kyc_pending_body")
                : t(lang, "bounty_new_kyc_start_body")}
            </p>
            <Link href="/kyc" className={buttonVariants({ variant: "primary", size: "sm" })}>
              {t(lang, "bounty_new_kyc_cta")}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <BountyForm />
      )}
    </section>
  );
}
