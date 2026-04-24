import Link from "next/link";
import type { ReactNode } from "react";
import { AuthAside } from "@/components/auth/auth-aside";
import { AuthSettingsBar } from "@/components/auth/auth-settings-bar";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <AuthAside />

      <section className="relative flex items-center justify-center px-6 py-12 md:px-12">
        <AuthSettingsBar />
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 flex min-h-11 items-center gap-2 md:hidden"
            aria-label="ConnectBounty"
          >
            <Logo size="md" />
          </Link>
          <div className="rounded-xl border border-border/50 bg-surface/80 p-6 shadow-[var(--shadow-glow)] backdrop-blur-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
