"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, ShieldCheck } from "lucide-react";
import { isNavItemActive } from "@/lib/nav-active";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLang } from "@/context/lang-context";

export function MobileNav({
  email,
  avatarUrl,
  displayName,
}: {
  email: string;
  avatarUrl?: string;
  displayName?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLang();

  // Main nav items (Profile + Security are shown in the account section)
  const navItems = [
    { href: "/dashboard", labelKey: "nav_dashboard" as const, exact: true },
    { href: "/bounties", labelKey: "nav_marketplace" as const },
    { href: "/bounties/mine", labelKey: "nav_my_bounties" as const },
    { href: "/referrals/mine", labelKey: "nav_referrals" as const },
    { href: "/payouts", labelKey: "nav_payouts" as const },
    { href: "/kyc", labelKey: "nav_kyc" as const },
  ];

  const accountItems = [
    { href: "/profile", labelKey: "nav_profile" as const, exact: true, icon: User },
    { href: "/settings/security", labelKey: "nav_security" as const, exact: true, icon: ShieldCheck },
  ];

  const navActive = (href: string, exact = false) => isNavItemActive(pathname, href, exact);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="relative flex h-4 w-5 flex-col justify-between">
          <span
            className={cn(
              "block h-0.5 w-full origin-center bg-current transition-all duration-200",
              open && "translate-y-[7px] rotate-45",
            )}
          />
          <span
            className={cn("block h-0.5 w-full bg-current transition-all duration-200", open && "opacity-0")}
          />
          <span
            className={cn(
              "block h-0.5 w-full origin-center bg-current transition-all duration-200",
              open && "-translate-y-[7px] -rotate-45",
            )}
          />
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-surface shadow-2xl">
            {/* User info header */}
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName || email}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                    {(displayName || email).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  {displayName && (
                    <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-2 shrink-0 min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>

            {/* Lang + Theme toggles */}
            <div className="flex items-center justify-center gap-2 border-b border-border/40 px-4 py-3">
              <LangToggle />
              <ThemeToggle />
            </div>

            {/* Main navigation */}
            <nav className="flex-1 overflow-y-auto px-4 py-4">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                        navActive(item.href, item.exact)
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                      )}
                    >
                      {t(item.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Account section separator */}
              <div className="mt-4 border-t border-border/40 pt-4">
                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                  Account
                </p>
                <ul className="space-y-1">
                  {accountItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-11 items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                            navActive(item.href, item.exact)
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {t(item.labelKey)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </nav>

            {/* Sign out */}
            <div className="border-t border-border/40 p-4">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-[var(--radius-md)] border border-border/60 py-2 text-sm text-muted-foreground transition-colors hover:text-destructive hover:border-destructive/40"
                >
                  {t("nav_logout")}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
