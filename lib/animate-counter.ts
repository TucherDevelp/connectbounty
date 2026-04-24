/**
 * Animiert eine Zahl in einem HTMLElement (ease-out cubic).
 */
export function animateCounter(
  el: HTMLElement,
  target: number,
  duration = 2000,
  locale = "de-DE",
): void {
  const start = performance.now();

  const update = (now: number) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - p) ** 3;
    el.textContent = Math.round(eased * target).toLocaleString(locale);
    if (p < 1) requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
}

/** Kompakte Währungsdarstellung (z. B. 2,4 Mio. €) für KPI-Karten */
export function animateCurrencyCompact(
  el: HTMLElement,
  targetCents: number,
  duration = 2000,
  locale = "de-DE",
): void {
  const start = performance.now();
  const target = targetCents / 100;

  const update = (now: number) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - p) ** 3;
    const v = eased * target;
    el.textContent = new Intl.NumberFormat(locale, {
      notation: "compact",
      compactDisplay: "short",
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 1,
    }).format(v);
    if (p < 1) requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
}
