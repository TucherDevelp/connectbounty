"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive } from "@/lib/nav-active";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLang } from "@/context/lang-context";

export function MobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLang();

  const navItems = [
    { href: "/dashboard", labelKey: "nav_dashboard" as const, exact: true },
    { href: "/bounties", labelKey: "nav_marketplace" as const },
    { href: "/bounties/mine", labelKey: "nav_my_bounties" as const },
    { href: "/referrals/mine", labelKey: "nav_referrals" as const },
    { href: "/payouts", labelKey: "nav_payouts" as const },
    { href: "/kyc", labelKey: "nav_kyc" as const },
    { href: "/profile", labelKey: "nav_profile" as const, exact: true },
    { href: "/settings/security", labelKey: "nav_security" as const, exact: true },
  ];

  const navActive = (href: string, exact = false) => isNavItemActive(pathname, href, exact);

  return (
    <div className="sm:hidden">
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
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
              <span className="text-sm font-medium text-muted-foreground">{email}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 border-b border-border/40 px-4 py-3">
              <LangToggle />
              <ThemeToggle />
            </div>

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
            </nav>

            <div className="border-t border-border/40 p-4">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-[var(--radius-md)] border border-border/60 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
