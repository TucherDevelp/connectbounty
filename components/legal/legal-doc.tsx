"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLang } from "@/context/lang-context";
import type { TranslationKey } from "@/lib/i18n";

const VARIANT: Record<
  "impressum" | "privacy" | "terms",
  { title: TranslationKey; body: TranslationKey }
> = {
  impressum: { title: "legal_impressum_title", body: "legal_impressum_body" },
  privacy: { title: "legal_privacy_title", body: "legal_privacy_body" },
  terms: { title: "legal_terms_title", body: "legal_terms_body" },
};

export function LegalDoc({ variant }: { variant: keyof typeof VARIANT }) {
  const { t } = useLang();
  const { title, body } = VARIANT[variant];

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {t("legal_back_home")}
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10 text-foreground">
        <h1 className="font-display text-3xl font-bold">{t(title)}</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">{t(body)}</p>
      </main>
    </>
  );
}
