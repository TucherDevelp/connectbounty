"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import type { Lang, TranslationKey } from "@/lib/i18n";
import { translations } from "@/lib/i18n";
import { LANG_COOKIE, type CookieLang } from "@/lib/lang-cookie";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

function writeLangCookie(next: CookieLang) {
  if (typeof document === "undefined") return;
  document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem(LANG_COOKIE, next);
  } catch {
    /* ignore */
  }
}

export function LangProvider({
  children,
  initialLang = "de",
}: {
  children: ReactNode;
  /** From server cookie so SSR + refresh match the user selection */
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasCookie = document.cookie.split(";").some((c) =>
      c.trim().startsWith(`${LANG_COOKIE}=`),
    );
    if (hasCookie) return;
    try {
      const s = localStorage.getItem(LANG_COOKIE);
      if (s === "en" || s === "de") {
        startTransition(() => {
          setLangState(s);
          writeLangCookie(s);
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writeLangCookie(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => {
      return translations[lang][key];
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLang must be used within LangProvider");
  }
  return ctx;
}
