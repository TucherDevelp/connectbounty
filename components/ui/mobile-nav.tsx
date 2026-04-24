"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/bounties", label: "Marktplatz" },
  { href: "/bounties/mine", label: "Meine Bounties" },
  { href: "/referrals/mine", label: "Empfehlungen" },
  { href: "/kyc", label: "Identitätsprüfung" },
];

export function MobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="sm:hidden">
      {/* Hamburger-Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <span className="relative flex h-4 w-5 flex-col justify-between">
          <span
            className={cn(
              "block h-0.5 w-full origin-center bg-current transition-all duration-200",
              open && "translate-y-[7px] rotate-45",
            )}
          />
          <span
            className={cn(
              "block h-0.5 w-full bg-current transition-all duration-200",
              open && "opacity-0",
            )}
          />
          <span
            className={cn(
              "block h-0.5 w-full origin-center bg-current transition-all duration-200",
              open && "-translate-y-[7px] -rotate-45",
            )}
          />
        </span>
      </button>

      {/* Slide-over Menü */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-[var(--color-surface-1)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--color-surface-border)] px-5 py-4">
              <span className="text-sm font-medium text-[var(--color-text-muted)]">{email}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-4">
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive(item.href, item.exact)
                          ? "bg-[var(--color-brand-400)]/10 text-[var(--color-brand-400)]"
                          : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-[var(--color-surface-border)] p-4">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-surface-border)] py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Abmelden
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
