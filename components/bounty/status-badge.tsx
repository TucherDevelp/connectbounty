import { cn } from "@/lib/utils";
import type { BountyStatus } from "@/lib/supabase/types";

const STATUS_META: Record<
  BountyStatus,
  { label: string; className: string }
> = {
  pending_review: {
    label: "Zur Prüfung",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  draft: {
    label: "Entwurf",
    className: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  },
  open: {
    label: "Aktiv",
    className: "bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)] text-[var(--color-success)]",
  },
  closed: {
    label: "Geschlossen",
    className: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  },
  expired: {
    label: "Abgelaufen",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  cancelled: {
    label: "Storniert",
    className: "bg-[color-mix(in_oklab,var(--color-error)_18%,transparent)] text-[var(--color-error)]",
  },
};

export function BountyStatusBadge({
  status,
  className,
}: {
  status: BountyStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
