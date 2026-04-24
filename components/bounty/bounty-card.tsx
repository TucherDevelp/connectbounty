import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BountyStatusBadge } from "@/components/bounty/status-badge";
import { formatBonus, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BountyListItem } from "@/lib/bounty/queries";

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const days = daysLeft(expiresAt);
  if (days === null) return null;
  const urgent = days <= 3;
  const warning = days <= 7;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        urgent
          ? "bg-[var(--color-error)]/15 text-[var(--color-error)]"
          : warning
          ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
      )}
    >
      {days === 0 ? "Heute" : `${days}d`}
    </span>
  );
}

/**
 * BountyCard v2 - Prämie prominent, klare Info-Hierarchie, Hover-Glow.
 */
export function BountyCard({
  bounty,
  showStatus = false,
}: {
  bounty: BountyListItem;
  showStatus?: boolean;
}) {
  return (
    <Link
      href={`/bounties/${bounty.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-bg)] rounded-[var(--radius-lg)]"
    >
      <article
        className={cn(
          "relative flex flex-col h-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-surface-border)]",
          "bg-[var(--color-surface-1)] transition-all duration-200",
          "group-hover:border-[var(--color-brand-400)]/30 group-hover:shadow-[0_0_0_1px_rgba(245,166,35,0.12),0_8px_32px_rgba(0,0,0,0.5)]",
        )}
      >
        {/* Amber-Glow oben */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-brand-400)]/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Kopfbereich: Prämie + Status */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-faint)]">
              Prämie
            </span>
            <span className="mt-0.5 font-display text-2xl font-bold tracking-tight text-[var(--color-brand-400)]">
              {formatBonus(Number(bounty.bonus_amount), bounty.bonus_currency)}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ExpiryBadge expiresAt={bounty.expires_at} />
            {showStatus && <BountyStatusBadge status={bounty.status} />}
          </div>
        </div>

        {/* Titel */}
        <div className="px-5 pt-3">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[var(--color-text-primary)] group-hover:text-white transition-colors">
            {bounty.title}
          </h3>
        </div>

        {/* Meta: Location, Industry */}
        {(bounty.location || bounty.industry) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 px-5">
            {bounty.location && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M8 1a5 5 0 0 0-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
                </svg>
                {bounty.location}
              </span>
            )}
            {bounty.location && bounty.industry && (
              <span className="text-[var(--color-text-faint)]">·</span>
            )}
            {bounty.industry && (
              <span className="inline-flex items-center rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                {bounty.industry}
              </span>
            )}
          </div>
        )}

        {/* Beschreibung */}
        <p className="mt-3 line-clamp-2 px-5 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {bounty.description}
        </p>

        {/* Tags */}
        {bounty.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1 px-5">
            {bounty.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--color-surface-border)] px-2 py-0.5 text-xs text-[var(--color-text-faint)]"
              >
                {tag}
              </span>
            ))}
            {bounty.tags.length > 4 && (
              <span className="text-xs text-[var(--color-text-faint)]">+{bounty.tags.length - 4}</span>
            )}
          </div>
        )}

        {/* Footer: Veröffentlicht + CTA-Arrow */}
        <div className="mt-auto flex items-center justify-between px-5 pb-4 pt-4">
          <span className="text-xs text-[var(--color-text-faint)]">
            {bounty.published_at ? `Seit ${formatDate(bounty.published_at)}` : "Entwurf"}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brand-400)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Details
            <ArrowRight className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          </span>
        </div>
      </article>
    </Link>
  );
}
