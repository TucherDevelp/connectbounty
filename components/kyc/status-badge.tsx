import type { KycStatus } from "@/lib/supabase/types";

const LABELS: Record<KycStatus, { text: string; className: string }> = {
  unverified: {
    text: "Unverifiziert",
    className:
      "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-surface-border)]",
  },
  pending: {
    text: "In Prüfung",
    className:
      "border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]",
  },
  approved: {
    text: "Verifiziert",
    className:
      "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]",
  },
  rejected: {
    text: "Abgelehnt",
    className:
      "border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]",
  },
  expired: {
    text: "Abgelaufen",
    className:
      "border-[hsl(var(--primary)/0.28)] bg-[var(--color-surface-2)] text-[hsl(var(--accent))]",
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
