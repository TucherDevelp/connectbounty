"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { useLang } from "@/context/lang-context";

export function AuthAside() {
  const { t } = useLang();

  return (
    <aside className="hidden flex-col justify-between border-r border-border/40 bg-surface p-12 md:flex">
      <Link href="/" className="flex items-center gap-3" aria-label={t("nav_home")}>
        <Logo size="md" />
      </Link>

      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">
          {t("auth_aside_title_line1")}
          <br />
          {t("auth_aside_title_line2")}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{t("auth_aside_body")}</p>
      </div>

      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("footer_copy")}
      </p>
    </aside>
  );
}
