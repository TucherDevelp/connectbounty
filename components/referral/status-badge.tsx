import { cn } from "@/lib/utils";
import type { ReferralStatus } from "@/lib/supabase/types";

const STATUS_META: Record<ReferralStatus, { label: string; className: string }> = {
  pending_review: {
    label: "Zur Prüfung",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  submitted: {
    label: "Eingereicht",
    className: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  },
  contacted: {
    label: "Kontaktiert",
    className:
      "bg-[color-mix(in_oklab,var(--color-info,var(--color-brand))_18%,transparent)] text-[var(--color-brand)]",
  },
  interviewing: {
    label: "Im Interview",
    className:
      "bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] text-[var(--color-brand)]",
  },
  hired: {
    label: "Eingestellt",
    className:
      "bg-[color-mix(in_oklab,var(--color-success)_22%,transparent)] text-[var(--color-success)]",
  },
  paid: {
    label: "Ausgezahlt",
    className:
      "bg-[color-mix(in_oklab,var(--color-success)_28%,transparent)] text-[var(--color-success)]",
  },
  rejected: {
    label: "Abgelehnt",
    className:
      "bg-[color-mix(in_oklab,var(--color-error)_18%,transparent)] text-[var(--color-error)]",
  },
  withdrawn: {
    label: "Zurückgezogen",
    className: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  },
};

export function ReferralStatusBadge({
  status,
  className,
}: {
  status: ReferralStatus;
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
