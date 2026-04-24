import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const email = user.email ?? "";
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? email.split("@")[0] ?? "";

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader email={email} displayName={displayName} />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
