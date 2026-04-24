import { cn } from "@/lib/utils";

export type LogoProps = {
  size?: "sm" | "md";
  /**
   * Immer dasselbe Bonbon aus `/assets/bonbon-logo.svg`.
   * `light` = invertiertes Mark (wirkt auf dunklem Grund wie das helle Logo).
   */
  tone?: "default" | "light";
  /** Standard: Wortmarke nur bei size md. Für kompakte Header mit sm: true setzen. */
  showWordmark?: boolean;
  /** Wortmarke erst ab `sm` sichtbar (mobil nur Bonbon). */
  compact?: boolean;
  className?: string;
};

const DIMS = {
  sm: { width: 40, height: 21 },
  md: { width: 52, height: 28 },
} as const;

/**
 * Markenzeichen: einheitliches Bonbon (SVG-Asset) + optional Wortmarke.
 */
export function Logo({
  size = "md",
  tone = "default",
  showWordmark: showWordmarkProp,
  compact = false,
  className,
}: LogoProps) {
  const { width, height } = DIMS[size];
  const showWordmark = showWordmarkProp ?? size === "md";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* SVG als Vektor; next/image ist für dieses Asset nicht nötig */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/bonbon-logo.svg"
        alt=""
        width={width}
        height={height}
        decoding="async"
        fetchPriority={size === "md" ? "high" : "auto"}
        className={cn(
          "shrink-0 object-contain object-left",
          tone === "light" && "brightness-0 invert opacity-95",
        )}
      />
      {showWordmark && (
        <span
          className={cn(
            "font-display text-base font-semibold tracking-tight text-foreground sm:text-lg",
            compact && "hidden sm:inline",
          )}
        >
          ConnectBounty
        </span>
      )}
    </span>
  );
}
