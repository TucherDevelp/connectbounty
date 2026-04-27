import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { listOpenBounties } from "@/lib/bounty/queries";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t } from "@/lib/i18n";
import { formatLocaleForLang } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { ClaimForm } from "./claim-form";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_referral_claim_title" });
}

export default async function ClaimPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");

  // Lade alle offenen Bounties (B wählt, für welches Inserat es eingestellt wurde)
  const { items } = await listOpenBounties({
    page: 1,
    q: undefined,
    industry: undefined,
    location: undefined,
    minBonus: undefined,
  });

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const locale = formatLocaleForLang(lang);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader
        title={t(lang, "claim_page_title")}
        description={t(lang, "claim_page_desc")}
      />
      <div className="mt-8">
        <ClaimForm bounties={items} bonusLocale={locale} />
      </div>
    </div>
  );
}
