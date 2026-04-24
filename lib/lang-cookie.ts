/** Cookie used by server (layout metadata) + client (LangProvider) for UI language. */
export const LANG_COOKIE = "cb-lang";

export type CookieLang = "de" | "en";

export function parseLangCookie(value: string | undefined): CookieLang {
  return value === "en" ? "en" : "de";
}
