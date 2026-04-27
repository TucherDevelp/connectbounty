import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t, type TranslationKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { UploadWizard } from "./upload-wizard";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_referral_upload_title" });
}

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");

  const supabase = await getSupabaseServerClient();
  const { data: referral } = await supabase
    .from("bounty_referrals")
    .select("id, status, candidate_user_id, bounties!bounty_referrals_bounty_id_fkey(title)")
    .eq("id", id)
    .eq("candidate_user_id", user.id)
    .maybeSingle();

  if (!referral) notFound();

  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

  if (referral.status !== "awaiting_hire_proof") {
    const bountyTitle = Array.isArray(referral.bounties)
      ? referral.bounties[0]?.title
      : (referral.bounties as { title: string } | null)?.title;
    const statusLabel = t(
      lang,
      `referral_status_${referral.status}` as TranslationKey,
    );

    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-[var(--color-text-muted)]">
          {t(lang, "hire_upload_wrong_status")
            .replace("{title}", bountyTitle ?? "–")
            .replace("{status}", statusLabel)}
        </p>
      </div>
    );
  }

  const bountyTitle = Array.isArray(referral.bounties)
    ? referral.bounties[0]?.title
    : (referral.bounties as { title: string } | null)?.title;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader
        title={t(lang, "hire_upload_page_title")}
        description={t(lang, "hire_upload_page_desc").replace("{title}", bountyTitle ?? "–")}
      />
      <div className="mt-8">
        <UploadWizard referralId={id} bucketName="hire-proofs" />
      </div>
    </div>
  );
}
