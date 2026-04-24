import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/kyc", label: "KYC Review" },
  { href: "/admin/bounties", label: "Bounties" },
  { href: "/admin/users", label: "Nutzer" },
  { href: "/admin/referrals", label: "Empfehlungen" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = await hasAnyRole(["admin", "superadmin", "moderator", "support"]);
  if (!isAdmin) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="rounded bg-[var(--color-brand)] px-1.5 py-0.5 text-xs font-bold text-black">
              ADMIN
            </span>
            <span className="font-display text-sm font-semibold tracking-tight">
              ConnectBounty
            </span>
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden text-xs text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text-muted)] sm:inline"
          >
            ← App
          </Link>
          <span className="hidden text-sm text-[var(--color-text-muted)] sm:inline">
            {user.email}
          </span>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" size="sm">
              Abmelden
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 bg-[var(--color-surface-bg)]">{children}</main>
    </div>
  );
}
