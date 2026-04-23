import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/roles";

/**
 * Layout für eingeloggte Bereiche. Doppelter Schutz:
 *   1. Proxy redirected unauthentifizierte Anfragen schon vor dem Render.
 *   2. Hier zusätzlich serverseitig getCurrentUser() prüfen, damit auch
 *      bei Race-Conditions / direktem RSC-Aufruf nichts geleakt wird.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/assets/bonbon-logo.svg"
            alt="ConnectBounty"
            width={32}
            height={18}
            priority
          />
          <span className="font-display text-base font-semibold tracking-tight">
            ConnectBounty
          </span>
        </Link>

        <div className="flex items-center gap-3">
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

      <main className="flex-1">{children}</main>
    </div>
  );
}
