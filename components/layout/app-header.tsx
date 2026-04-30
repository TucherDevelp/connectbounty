"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/ui/nav-link";
import { MobileNav } from "@/components/ui/mobile-nav";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLang } from "@/context/lang-context";

function UserAvatar({ email, displayName, avatarUrl }: { email: string; displayName: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName || email}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  // Fallback: initials from displayName, or first 2 chars of email
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary"
    >
      {initials}
    </div>
  );
}

export function AppHeader({
  email,
  displayName,
  avatarUrl,
}: {
  email: string;
  displayName: string;
  avatarUrl?: string;
}) {
  const { t } = useLang();

  const nav = [
    { href: "/dashboard", labelKey: "nav_dashboard" as const, exact: true },
    { href: "/bounties", labelKey: "nav_marketplace" as const },
    { href: "/bounties/mine", labelKey: "nav_my_bounties" as const },
    { href: "/referrals/mine", labelKey: "nav_referrals" as const },
    { href: "/payouts", labelKey: "nav_payouts" as const },
    { href: "/kyc", labelKey: "nav_kyc" as const },
    { href: "/profile", labelKey: "nav_profile" as const, exact: true },
    { href: "/settings/security", labelKey: "nav_security" as const, exact: true },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/40 bg-surface/90 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="ConnectBounty">
          <Logo size="sm" showWordmark compact />
        </Link>

        <nav aria-label={t("a11y_main_nav")} className="hidden items-center gap-5 sm:flex">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact}>
              {t(n.labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <LangToggle />
          <ThemeToggle />
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <Link href="/profile" className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1 hover:bg-[var(--color-surface-2)]">
            <UserAvatar email={email} displayName={displayName} avatarUrl={avatarUrl} />
            <span className="max-w-[140px] truncate text-xs text-muted-foreground" title={email}>
              {displayName}
            </span>
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" size="sm">
              {t("nav_logout")}
            </Button>
          </form>
        </div>
        <MobileNav email={email} />
      </div>
    </header>
  );
}
