import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyRole } from "@/lib/auth/roles";
import { AdminHeader } from "@/components/layout/admin-header";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = await hasAnyRole(["admin", "superadmin", "moderator", "support"]);
  if (!isAdmin) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col">
      <AdminHeader email={user.email ?? ""} />
      <main className="flex-1 bg-[var(--color-surface-bg)]">{children}</main>
    </div>
  );
}
