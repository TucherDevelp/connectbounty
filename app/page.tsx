import { redirect } from "next/navigation";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { getCurrentUser } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <MarketingPage />;
}
