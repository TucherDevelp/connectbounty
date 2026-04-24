"use client";

import Link from "next/link";
import { useLang } from "@/context/lang-context";

export function AppFooter() {
  const { t } = useLang();

  return (
    <footer className="border-t border-border/40 bg-surface px-6 py-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          © {new Date().getFullYear()} {t("footer_copy")}
        </span>
        <div className="flex flex-wrap gap-4">
          <Link href="/legal/impressum" className="transition-colors hover:text-foreground">
            {t("footer_legal")}
          </Link>
          <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
            {t("footer_privacy")}
          </Link>
          <Link href="/legal/terms" className="transition-colors hover:text-foreground">
            {t("footer_terms")}
          </Link>
          <Link href="/bounties" className="transition-colors hover:text-foreground">
            {t("nav_marketplace")}
          </Link>
          <Link href="/kyc" className="transition-colors hover:text-foreground">
            {t("nav_kyc")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
