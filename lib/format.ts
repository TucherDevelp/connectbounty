/**
 * Reine Format-Helpers, die clientseitig wie serverseitig verwendet werden
 * können. Keine Abhängigkeiten zu Supabase/Next - bewusst klein gehalten.
 */

/** Browser/Node locale tag for app language */
export type FormatLocale = "de-DE" | "en-US";

export function formatLocaleForLang(lang: "de" | "en"): FormatLocale {
  return lang === "de" ? "de-DE" : "en-US";
}

export function formatBonus(amount: number, currency: string, locale: FormatLocale = "de-DE"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(
  value: string | null | undefined,
  locale: FormatLocale = "de-DE",
): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}
