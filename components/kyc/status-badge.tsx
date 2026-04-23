import type { KycStatus } from "@/lib/supabase/types";

const LABELS: Record<KycStatus, { text: string; className: string }> = {
  unverified: {
    text: "Unverifiziert",
    className:
      "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-surface-border)]",
  },
  pending: {
    text: "In Prüfung",
    className: "bg-amber-500/10 text-amber-200 border-amber-500/40",
  },
  approved: {
    text: "Verifiziert",
    className: "bg-emerald-500/10 text-emerald-200 border-emerald-500/40",
  },
  rejected: {
    text: "Abgelehnt",
    className: "bg-red-500/10 text-red-200 border-red-500/40",
  },
  expired: {
    text: "Abgelaufen",
    className: "bg-orange-500/10 text-orange-200 border-orange-500/40",
  },
};

export function KycStatusBadge({ status }: { status: KycStatus }) {
  const { text, className } = LABELS[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${className}`}
    >
      {text}
    </span>
  );
}
