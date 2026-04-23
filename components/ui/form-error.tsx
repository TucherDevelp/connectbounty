import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Inline-Fehlertext unter einem einzelnen Form-Feld. Per ARIA mit dem
 * zugehörigen Input verknüpfbar via aria-describedby={id}.
 */
export function FieldError({
  id,
  message,
  className,
}: {
  id?: string;
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn("text-xs font-medium text-[var(--color-error)]", className)}
    >
      {message}
    </p>
  );
}

/**
 * Summary-Banner für seitenübergreifende Form-Fehler (z. B. "Login fehlgeschlagen").
 */
export function FormAlert({
  variant = "error",
  children,
}: {
  variant?: "error" | "info" | "success" | "warning";
  children: React.ReactNode;
}) {
  const colors = {
    error: "border-[var(--color-error)]/40 bg-[var(--color-error)]/10 text-[var(--color-error)]",
    info: "border-[var(--color-info)]/40 bg-[var(--color-info)]/10 text-[var(--color-info)]",
    success:
      "border-[var(--color-success)]/40 bg-[var(--color-success)]/10 text-[var(--color-success)]",
    warning:
      "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  } as const;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
        colors[variant],
      )}
    >
      {children}
    </div>
  );
}
