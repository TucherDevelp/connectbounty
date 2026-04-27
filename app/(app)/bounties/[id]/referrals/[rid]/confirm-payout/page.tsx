import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyBillingForm } from "./company-billing-form";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_confirm_payout_title" });
}

export default async function ConfirmPayoutPage({
  params,
}: {
  params: Promise<{ id: string; rid: string }>;
}) {
  const { id: bountyId, rid } = await params;

  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");

  const supabase = await getSupabaseServerClient();

  // Nur Owner darf diese Seite sehen
  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, status, bounties!bounty_referrals_bounty_id_fkey(owner_id, title)")
    .eq("id", rid)
    .eq("bounty_id", bountyId)
    .maybeSingle();

  if (!referral) notFound();

  const bounty = Array.isArray(referral.bounties)
    ? referral.bounties[0]
    : (referral.bounties as { owner_id: string; title: string } | null);

  if (bounty?.owner_id !== user.id) redirect(`/bounties/${bountyId}`);
  if (referral.status !== "awaiting_payout_account") {
    redirect(`/bounties/${bountyId}/referrals/${rid}`);
  }

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader
        title={t(lang, "confirm_payout_page_title")}
        description={t(lang, "confirm_payout_page_desc").replace("{title}", bounty?.title ?? "–")}
      />
      <div className="mt-8">
        <CompanyBillingForm referralId={rid} bountyId={bountyId} />
      </div>
    </div>
  );
}
