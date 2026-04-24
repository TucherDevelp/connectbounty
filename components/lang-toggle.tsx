"use client";

import { useLang } from "@/context/lang-context";
import { cn } from "@/lib/utils";

export function LangToggle() {
  const { lang, setLang, t } = useLang();

  return (
    <div
      className="inline-flex items-center rounded-full border border-border/60 bg-surface/80 p-0.5 backdrop-blur-sm"
      role="group"
      aria-label="Sprache"
    >
      {(["de", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={cn(
            "min-h-9 min-w-11 rounded-full px-3 text-xs font-semibold transition-colors",
            lang === code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code === "de" ? t("lang_de") : t("lang_en")}
        </button>
      ))}
    </div>
  );
}
