import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <Image
        src="/assets/bonbon-logo.svg"
        alt="ConnectBounty Logo"
        width={120}
        height={64}
        priority
        className="opacity-90"
      />

      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
          ConnectBounty
        </h1>
        <p className="mx-auto max-w-xl text-base text-[var(--color-text-muted)]">
          Plattform für Job-Referral-Boni. Phase 0 läuft – das Fundament steht. Auth, KYC,
          Marketplace, Chat, Payments und Admin werden in den nächsten Phasen sukzessive aufgebaut.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" size="lg" disabled>
          Marktplatz (Phase 3)
        </Button>
        <Button variant="secondary" size="lg" disabled>
          Login (Phase 1)
        </Button>
      </div>

      <div className="rounded-md border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-4 py-2 text-xs text-[var(--color-text-muted)]">
        Build: Next.js 16 · React 19 · Tailwind v4 · TypeScript strict
      </div>
    </main>
  );
}
