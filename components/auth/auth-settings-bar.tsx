"use client";

import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthSettingsBar() {
  return (
    <div className="absolute right-4 top-4 z-10 flex items-center gap-1 sm:right-6 sm:top-6 sm:gap-2">
      <LangToggle />
      <ThemeToggle />
    </div>
  );
}
