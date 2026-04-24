import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KycStatus } from "@/lib/supabase/types";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { DashboardView } from "./dashboard-view";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_dashboard_title" });
}
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_status, display_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const kycStatus: KycStatus = profile?.kyc_status ?? "unverified";
  const displayName =
    profile?.display_name ??
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "…";

  return <DashboardView displayName={displayName} kycStatus={kycStatus} />;
}
