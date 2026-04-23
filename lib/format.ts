/**
 * Reine Format-Helpers, die clientseitig wie serverseitig verwendet werden
 * können. Keine Abhängigkeiten zu Supabase/Next – bewusst klein gehalten.
 */

export function formatBonus(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}
