import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/ui/nav-link";
import { MobileNav } from "@/components/ui/mobile-nav";
import { getCurrentUser } from "@/lib/auth/roles";

const NAV = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/bounties", label: "Marktplatz" },
  { href: "/bounties/mine", label: "Meine Bounties" },
  { href: "/referrals/mine", label: "Empfehlungen" },
  { href: "/payouts", label: "Auszahlungen" },
  { href: "/kyc", label: "KYC" },
];

function UserAvatar({ email }: { email: string }) {
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-400)]/20 text-xs font-semibold text-[var(--color-brand-400)]"
    >
      {initials}
    </div>
  );
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const email = user.email ?? "";
  const displayName = (user.user_metadata?.display_name as string | undefined) ?? email.split("@")[0];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-surface-border)] bg-[var(--color-surface-1)]/90 px-4 py-3 backdrop-blur-md sm:px-6">
        {/* Logo + Desktop Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/assets/bonbon-logo.svg"
              alt="ConnectBounty Logo"
              width={32}
              height={18}
              priority
            />
            <span className="font-display text-base font-semibold tracking-tight hidden sm:inline">
              ConnectBounty
            </span>
          </Link>

          <nav aria-label="Hauptnavigation" className="hidden items-center gap-5 sm:flex">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href} exact={n.exact}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Desktop User + Mobile Menu */}
        <div className="flex items-center gap-3">
          {/* Desktop: Nutzer-Info + Abmelden */}
          <div className="hidden items-center gap-3 sm:flex">
            <UserAvatar email={email} />
            <span className="max-w-[140px] truncate text-xs text-[var(--color-text-muted)]" title={email}>
              {displayName}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Abmelden
              </Button>
            </form>
          </div>

          {/* Mobile Hamburger */}
          <MobileNav email={email} />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-[var(--color-text-faint)]">
          <span>© {new Date().getFullYear()} ConnectBounty</span>
          <div className="flex gap-4">
            <Link href="/bounties" className="hover:text-[var(--color-text-muted)] transition-colors">Marktplatz</Link>
            <Link href="/kyc" className="hover:text-[var(--color-text-muted)] transition-colors">KYC</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
