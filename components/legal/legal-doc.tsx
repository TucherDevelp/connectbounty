"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLang } from "@/context/lang-context";
import type { TranslationKey } from "@/lib/i18n";

const VARIANT: Record<
  "impressum" | "privacy" | "terms" | "payment_terms",
  { title: TranslationKey; body: TranslationKey }
> = {
  impressum: { title: "legal_impressum_title", body: "legal_impressum_body" },
  privacy: { title: "legal_privacy_title", body: "legal_privacy_body" },
  terms: { title: "legal_terms_title", body: "legal_terms_body" },
  payment_terms: { title: "legal_payment_terms_title", body: "legal_payment_terms_body" },
};

export function LegalDoc({ variant }: { variant: keyof typeof VARIANT }) {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const { title, body } = VARIANT[variant];
  const from = searchParams.get("from");
  const doc = searchParams.get("doc");
  const isFromBountyNew = from === "bounty-new";

  useEffect(() => {
    if (!isFromBountyNew) return;
    if (doc !== "payment" && doc !== "agb") return;

    const storageKey = doc === "payment" ? "bounty-new:read-payment-terms" : "bounty-new:read-agb";
    const onScroll = () => {
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (!atBottom) return;
      try {
        sessionStorage.setItem(storageKey, "true");
      } catch {
        // ignore storage errors
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [doc, isFromBountyNew]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
          <Link
            href={isFromBountyNew ? "/bounties/new" : "/"}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {isFromBountyNew ? t("legal_back_bounty_new") : t("legal_back_home")}
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
