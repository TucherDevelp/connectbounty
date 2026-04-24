"use client";

import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/ui/nav-link";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLang } from "@/context/lang-context";

export function AdminHeader({ email }: { email: string }) {
  const { t } = useLang();

  const nav = [
    { href: "/admin", labelKey: "nav_admin_dashboard" as const, exact: true },
    { href: "/admin/kyc", labelKey: "nav_admin_kyc" as const },
    { href: "/admin/bounties", labelKey: "nav_admin_bounties" as const },
    { href: "/admin/users", labelKey: "nav_admin_users" as const },
    { href: "/admin/referrals", labelKey: "nav_admin_referrals" as const },
    { href: "/admin/disputes", labelKey: "nav_admin_disputes" as const },
  ];

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-6 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-6">
        <Link href="/admin" className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-[var(--color-brand)] px-1.5 py-0.5 text-xs font-bold text-black">
            {t("nav_admin_badge")}
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">ConnectBounty</span>
        </Link>
        <nav
          aria-label={t("a11y_admin_nav")}
          className="hidden min-w-0 flex-1 items-center gap-4 overflow-x-auto text-sm sm:flex"
        >
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact} className="shrink-0">
              {t(n.labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
        </div>
        <Link
          href="/dashboard"
          className="hidden text-xs text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text-muted)] sm:inline"
        >
          {t("nav_back_app")}
        </Link>
        <span
          className="hidden max-w-[160px] truncate text-sm text-[var(--color-text-muted)] sm:inline"
          title={email}
        >
          {email}
        </span>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" size="sm">
            {t("nav_logout")}
          </Button>
        </form>
      </div>
    </header>
  );
}
