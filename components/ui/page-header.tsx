import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Einheitlicher Seitenheader mit Titel, optionalem Untertitel und
 * optionalem Aktion-Slot (z. B. Buttons).
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          {title}
        </h1>
        {description && (
          <p className="max-w-xl text-sm text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Breadcrumb-Navigation oberhalb von Detailseiten.
 */
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-[var(--color-text-faint)]">›</span>}
          {item.href ? (
            <a
              href={item.href}
              className="hover:text-[var(--color-text-primary)] transition-colors"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-[var(--color-text-primary)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * Leerer Zustand mit Icon-Platzhalter, Titel und Beschreibung.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-6 py-16 text-center">
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-brand)]">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
