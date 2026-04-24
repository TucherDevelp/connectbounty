import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { listOpenBounties } from "@/lib/bounty/queries";
import { localizedMetadata } from "@/lib/i18n-metadata";
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

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader
        title="Ich wurde eingestellt"
        description="Wähle das Inserat aus, über das du vermittelt wurdest. Danach lädst du deinen Nachweis hoch."
      />
      <div className="mt-8">
        <ClaimForm bounties={items} />
      </div>
    </div>
  );
}
