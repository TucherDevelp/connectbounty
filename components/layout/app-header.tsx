"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, User, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/ui/nav-link";
import { MobileNav } from "@/components/ui/mobile-nav";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLang } from "@/context/lang-context";

function UserAvatar({
  email,
  displayName,
  avatarUrl,
  size = "sm",
}: {
  email: string;
  displayName: string;
  avatarUrl?: string;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName || email}
        className={`${size === "md" ? "h-9 w-9" : "h-7 w-7"} shrink-0 rounded-full object-cover`}
      />
    );
  }
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-primary/20 font-semibold text-primary`}
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Main nav items (Profile + Security moved to user dropdown)
  const nav = [
    { href: "/dashboard", labelKey: "nav_dashboard" as const, exact: true },
    { href: "/bounties", labelKey: "nav_marketplace" as const },
    { href: "/bounties/mine", labelKey: "nav_my_bounties" as const },
    { href: "/referrals/mine", labelKey: "nav_referrals" as const },
    { href: "/payouts", labelKey: "nav_payouts" as const },
    { href: "/kyc", labelKey: "nav_kyc" as const },
  ];

  return (
    <header className="sticky top-0 z-30 flex min-h-[3.25rem] items-center justify-between gap-2 border-b border-border/40 bg-surface/90 px-[max(0.75rem,env(safe-area-inset-left))] py-2.5 pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-4 sm:py-3 lg:px-6">
      {/* Left: Logo + nav */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4 lg:gap-6">
        <Link
          href="/dashboard"
          className="flex min-w-0 max-w-[min(100%,11rem)] shrink items-center gap-2 sm:max-w-none"
          aria-label="ConnectBounty"
        >
          <Logo size="sm" showWordmark compact />
        </Link>

        {/* Desktop nav — lg+ only */}
        <nav aria-label={t("a11y_main_nav")} className="hidden items-center gap-4 lg:flex xl:gap-5">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact}>
              {t(n.labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Right: toggles + user chip + mobile hamburger */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Desktop-only: lang + theme toggles */}
        <div className="hidden items-center gap-2 lg:flex">
          <LangToggle />
          <ThemeToggle />
        </div>

        {/* User dropdown (desktop only) */}
        <div ref={menuRef} className="relative hidden lg:block">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <UserAvatar email={email} displayName={displayName} avatarUrl={avatarUrl} />
            <span className="max-w-[120px] truncate text-xs text-muted-foreground" title={email}>
              {displayName || email.split("@")[0]}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>

          {/* Dropdown panel */}
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-surface shadow-xl"
            >
              {/* User info */}
              <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
                <UserAvatar email={email} displayName={displayName} avatarUrl={avatarUrl} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName || email.split("@")[0]}</p>
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </div>
              </div>

              {/* Menu items */}
              <div className="p-1">
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {t("nav_profile")}
                </Link>
                <Link
                  href="/settings/security"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {t("nav_security")}
                </Link>
              </div>

              {/* Sign out */}
              <div className="border-t border-border/40 p-1">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center rounded-[var(--radius-md)] px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    {t("nav_logout")}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Mobile hamburger (< lg) */}
        <MobileNav email={email} avatarUrl={avatarUrl} displayName={displayName} />
      </div>
    </header>
  );
}
