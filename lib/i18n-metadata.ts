import { cookies } from "next/headers";
import type { Metadata } from "next";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import type { TranslationKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";

/** Document title (and optional description) from `cb-lang` cookie. */
export async function localizedMetadata(opts: {
  title: TranslationKey;
  description?: TranslationKey;
}): Promise<Metadata> {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const meta: Metadata = { title: t(lang, opts.title) };
  if (opts.description) {
    meta.description = t(lang, opts.description);
  }
  return meta;
}

/** @deprecated Use localizedMetadata; kept for legal routes */
export async function legalPageMetadata(titleKey: TranslationKey): Promise<Metadata> {
  return localizedMetadata({ title: titleKey });
}
