import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { localizedMetadata } from "@/lib/i18n-metadata";
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

  if (referral.status !== "awaiting_hire_proof") {
    const bountyTitle = Array.isArray(referral.bounties)
      ? referral.bounties[0]?.title
      : (referral.bounties as { title: string } | null)?.title;

    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-[var(--color-text-muted)]">
          Für dieses Referral ({bountyTitle}) ist kein Upload erforderlich (Status: {referral.status}).
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
        title="Nachweis hochladen"
        description={`Inserat: ${bountyTitle ?? "–"}`}
      />
      <div className="mt-8">
        <UploadWizard referralId={id} bucketName="hire-proofs" />
      </div>
    </div>
  );
}
