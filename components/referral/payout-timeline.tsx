import { ArrowRight, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";

type TimelineEvent = {
  label: string;
  description?: string;
  date?: string | null;
  done: boolean;
  active?: boolean;
};

function TimelineItem({ event, last }: { event: TimelineEvent; last: boolean }) {
  return (
    <li className="flex gap-4">
      {/* Line + dot */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            event.done
              ? "bg-[var(--color-success)] text-white"
              : event.active
                ? "bg-[var(--color-brand-400)] text-white"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]",
          )}
        >
          {event.done ? (
            <Check className="size-3.5" strokeWidth={2.75} aria-hidden />
          ) : (
            <Circle className="size-3 text-[var(--color-text-faint)]" strokeWidth={2} aria-hidden />
          )}
        </span>
        {!last && (
          <div
            className={cn(
              "w-0.5 flex-1",
              event.done ? "bg-[var(--color-success)]" : "bg-[var(--color-surface-border)]",
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn("pb-6", last && "pb-0")}>
        <p
          className={cn(
            "text-sm font-medium",
            event.done
              ? "text-[var(--color-success)]"
              : event.active
                ? "text-[var(--color-text-primary)]"
                : "text-[var(--color-text-faint)]",
          )}
        >
          {event.label}
        </p>
        {event.description && (
          <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">{event.description}</p>
        )}
        {event.date && (
          <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
            {new Date(event.date).toLocaleString(
              // Simple language detection for date formatting
              typeof window !== "undefined" ? navigator.language : "en-US",
            )}
          </p>
        )}
      </div>
    </li>
  );
}

export type PayoutTimelineProps = {
  lang: Lang;
  invoiceId: string | null;
  invoiceHostedUrl: string | null;
  invoiceCreatedAt?: string | null;
  invoicePaidAt?: string | null;
  referrerTransferId: string | null;
  candidateTransferId: string | null;
  refOfATransferId: string | null;
  refOfBTransferId: string | null;
  paidAt: string | null;
  status: string;
};

export function PayoutTimeline({
  lang,
  invoiceId,
  invoiceHostedUrl,
  invoiceCreatedAt,
  invoicePaidAt,
  referrerTransferId,
  candidateTransferId,
  refOfATransferId,
  refOfBTransferId,
  paidAt,
  status,
}: PayoutTimelineProps) {
  const events: TimelineEvent[] = [
    {
      label: t(lang, "timeline_inv_created"),
      description: invoiceId
        ? t(lang, "timeline_inv_created_desc").replace("{id}", invoiceId.slice(0, 12))
        : undefined,
      date: invoiceCreatedAt,
      done: Boolean(invoiceId),
      active: !invoiceId,
    },
    {
      label: t(lang, "timeline_inv_sent"),
      description: invoiceHostedUrl
        ? t(lang, "timeline_inv_sent_desc_done")
        : t(lang, "timeline_inv_sent_desc_pending"),
      done: Boolean(invoiceHostedUrl),
      active: Boolean(invoiceId) && !invoiceHostedUrl,
    },
    {
      label: t(lang, "timeline_inv_paid"),
      date: invoicePaidAt,
      done: Boolean(invoicePaidAt),
      active: Boolean(invoiceHostedUrl) && !invoicePaidAt,
    },
    {
      label: t(lang, "timeline_transfers_done"),
      description: [
        referrerTransferId && `A: ${referrerTransferId.slice(0, 12)}…`,
        candidateTransferId && `B: ${candidateTransferId.slice(0, 12)}…`,
        refOfATransferId && `Ref-A: ${refOfATransferId.slice(0, 12)}…`,
        refOfBTransferId && `Ref-B: ${refOfBTransferId.slice(0, 12)}…`,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
      done: Boolean(referrerTransferId && candidateTransferId),
      active: Boolean(invoicePaidAt) && !referrerTransferId,
    },
    {
      label: t(lang, "timeline_payout_complete"),
      date: paidAt,
      done: status === "paid",
      active: Boolean(referrerTransferId) && status !== "paid",
    },
  ];

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-6">
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
        {t(lang, "timeline_title")}
      </h3>

      {invoiceHostedUrl && status !== "paid" && (
        <a
          href={invoiceHostedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-brand-400)] px-3 py-2 text-sm text-[var(--color-brand-400)] hover:bg-[var(--color-brand-400)]/10"
        >
          <span className="inline-flex items-center gap-1.5">
            {t(lang, "timeline_open_invoice")}
            <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </span>
        </a>
      )}

      <ol className="flex flex-col">
        {events.map((e, i) => (
          <TimelineItem key={e.label} event={e} last={i === events.length - 1} />
        ))}
      </ol>
    </div>
  );
}
