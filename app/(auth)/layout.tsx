import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Layout für alle öffentlichen Auth-Seiten (login, register, reset).
 *
 * Mobile: einspaltig, Logo oben.
 * Desktop (md+): zweispaltig – links Brand-Panel mit Slogan,
 *                rechts das eigentliche Formular.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-12 md:flex">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/assets/bonbon-logo.svg"
            alt="ConnectBounty Logo"
            width={48}
            height={26}
            priority
          />
          <span className="font-display text-lg font-semibold tracking-tight">
            ConnectBounty
          </span>
        </Link>

        <div className="space-y-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text-primary)]">
            Job-Referrals,
            <br />
            transparent vermittelt.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-[var(--color-text-muted)]">
            Inseriere Sign-On-Boni und Vermittlungs-Provisionen, finde geprüfte
            Kandidat:innen, kommuniziere sicher und werde nach erfolgreicher
            Vermittlung ausgezahlt – alles auf einer Plattform.
          </p>
        </div>

        <p className="text-xs text-[var(--color-text-faint)]">
          © {new Date().getFullYear()} ConnectBounty
        </p>
      </aside>

      <section className="flex items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 flex items-center gap-2 md:hidden"
            aria-label="Zur Startseite"
          >
            <Image
              src="/assets/bonbon-logo.svg"
              alt=""
              width={36}
              height={20}
              aria-hidden
            />
            <span className="font-display text-base font-semibold">ConnectBounty</span>
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
