"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, ShieldCheck } from "lucide-react";
import { isNavItemActive } from "@/lib/nav-active";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { useLang } from "@/context/lang-context";

/**
 * Vollbild-Navigation unter `lg`.
 *
 * Wichtig für Layout bei allen Viewports:
 * - Kein schmales Side-Panel mehr: sonst bleibt die Seite links sichtbar und
 *   der Abmelden-Block wirkt „über“ dem Seiteninhalt.
 * - flex-1 + min-h-0 + overflow-y-auto: Scroll nur im Mittelteil, Footer fix unten.
 * - Body-Scroll-Lock + Escape: konsistentes UX.
 */
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
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { t } = useLang();

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        aria-controls="mobile-nav-sheet"
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

      {open &&
        mounted &&
        createPortal(
          <div
            id="mobile-nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("a11y_main_nav")}
            className="fixed inset-0 z-[100] flex max-h-[100dvh] flex-col bg-background text-foreground shadow-2xl"
          >
          {/* Top: Marke + Schließen — Logo liegt im Sheet, nicht unter einem separaten Overlay */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-[var(--radius-md)] py-1 pr-2 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="ConnectBounty"
            >
              <Logo size="sm" showWordmark compact />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-[var(--color-surface-2)] hover:text-foreground"
              aria-label="Schließen"
            >
              <span className="text-lg leading-none" aria-hidden>
                ✕
              </span>
            </button>
          </div>

          {/* Nutzerzeile */}
          <div className="flex shrink-0 items-center gap-3 border-b border-border/40 px-4 py-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName || email}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                {(displayName || email).slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {displayName && (
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              )}
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>

          {/* Sprache & Theme */}
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-b border-border/40 px-4 py-3">
            <LangToggle />
            <ThemeToggle />
          </div>

          {/* Navigation — nur dieser Bereich scrollt */}
          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
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
                        : "text-muted-foreground hover:bg-[var(--color-surface-2)] hover:text-foreground",
                    )}
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>

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
                            : "text-muted-foreground hover:bg-[var(--color-surface-2)] hover:text-foreground",
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

          {/* Abmelden — immer unten im Sheet, nicht über dem Seiteninhalt */}
          <div className="shrink-0 border-t border-border/40 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <form action={logoutAction}>
              <button
                type="submit"
                className="min-h-11 w-full rounded-[var(--radius-md)] border border-border/60 py-2.5 text-sm text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                {t("nav_logout")}
              </button>
            </form>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
