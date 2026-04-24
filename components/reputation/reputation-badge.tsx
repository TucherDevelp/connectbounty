import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Check, Circle, Minus, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReputationScore = {
  paid_on_time: number;
  paid_late: number;
  failed_count: number;
  disputed_against: number;
  dispute_won: number;
  total_paid_cents: number;
};

type ReputationLevel = "excellent" | "good" | "neutral" | "poor" | "new";

function getLevel(score: ReputationScore): ReputationLevel {
  const total = score.paid_on_time + score.paid_late + score.failed_count;
  if (total === 0) return "new";
  if (score.failed_count > 2 || score.disputed_against > 1) return "poor";
  const onTimeRate = score.paid_on_time / total;
  if (onTimeRate >= 0.9 && total >= 3) return "excellent";
  if (onTimeRate >= 0.7) return "good";
  return "neutral";
}

const LEVEL_META: Record<
  ReputationLevel,
  { label: string; color: string; bg: string; Icon: LucideIcon }
> = {
  excellent: {
    label: "Zuverlässig zahlt",
    color: "text-[var(--color-success)]",
    bg: "bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)] border-[var(--color-success)]",
    Icon: Star,
  },
  good: {
    label: "Gut bewertet",
    color: "text-[var(--color-brand-400)]",
    bg: "bg-[color-mix(in_oklab,var(--color-brand-400)_10%,transparent)] border-[var(--color-brand-400)]",
    Icon: Check,
  },
  neutral: {
    label: "Durchschnitt",
    color: "text-[var(--color-text-muted)]",
    bg: "bg-[var(--color-surface-2)] border-[var(--color-surface-border)]",
    Icon: Circle,
  },
  poor: {
    label: "Zahlt oft nicht",
    color: "text-[var(--color-error)]",
    bg: "bg-[color-mix(in_oklab,var(--color-error)_8%,transparent)] border-[var(--color-error)]",
    Icon: AlertTriangle,
  },
  new: {
    label: "Neu",
    color: "text-[var(--color-text-faint)]",
    bg: "bg-[var(--color-surface-2)] border-[var(--color-surface-border)]",
    Icon: Minus,
  },
};

/** Kompakte Inline-Badge - z. B. neben Nutzernamen */
export function ReputationBadge({
  score,
  showDetail = false,
}: {
  score: ReputationScore;
  showDetail?: boolean;
}) {
  const level = getLevel(score);
  const meta = LEVEL_META[level];
  const Icon = meta.Icon;
  const total = score.paid_on_time + score.paid_late + score.failed_count;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        meta.bg,
        meta.color,
      )}
      title={
        showDetail
          ? undefined
          : `${score.paid_on_time} pünktlich · ${score.paid_late} spät · ${score.failed_count} ausgefallen`
      }
    >
      <Icon className="size-3.5 shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
      {meta.label}
      {total > 0 && (
        <span className="opacity-60">({total})</span>
      )}
    </span>
  );
}

/** Ausführliche Reputation-Karte - z. B. auf Profil-Seite */
export function ReputationCard({ score }: { score: ReputationScore }) {
  const total = score.paid_on_time + score.paid_late + score.failed_count;

  const rows: { label: string; value: number | string; highlight?: boolean }[] = [
    { label: "Pünktlich bezahlt", value: score.paid_on_time, highlight: true },
    { label: "Spät bezahlt", value: score.paid_late },
    { label: "Zahlungsausfall", value: score.failed_count },
    { label: "Dispute erhalten", value: score.disputed_against },
    { label: "Dispute gewonnen", value: score.dispute_won },
    {
      label: "Gesamtvolumen",
      value: `${(score.total_paid_cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`,
    },
  ];

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Reputation</h3>
        <ReputationBadge score={score} />
      </div>

      {total === 0 ? (
        <p className="mt-3 text-xs text-[var(--color-text-faint)]">
          Noch keine abgeschlossenen Transaktionen.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-surface-border)]">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-[var(--color-text-muted)]">{row.label}</span>
              <span
                className={cn(
                  "font-medium",
                  row.highlight
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-text-primary)]",
                )}
              >
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
