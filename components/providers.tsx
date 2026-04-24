"use client";

import type { ReactNode } from "react";
import { LangProvider } from "@/context/lang-context";
import { ThemeProvider } from "@/components/theme-provider";
import type { Lang } from "@/lib/i18n";

export function AppProviders({
  children,
  initialLang = "de",
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  return (
    <LangProvider initialLang={initialLang}>
      <ThemeProvider>{children}</ThemeProvider>
    </LangProvider>
  );
}
