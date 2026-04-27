"use client";

import { cn } from "@/lib/utils";
import type { BountyStatus } from "@/lib/supabase/types";
import { useLang } from "@/context/lang-context";
import type { TranslationKey } from "@/lib/i18n";

const STATUS_META: Record<BountyStatus, { labelKey: TranslationKey; className: string }> = {
  pending_review: {
    labelKey: "bounty_status_pending_review",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  draft: {
    labelKey: "bounty_status_draft",
    className: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  },
  open: {
    labelKey: "bounty_status_open",
    className: "bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)] text-[var(--color-success)]",
  },
  closed: {
    labelKey: "bounty_status_closed",
    className: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  },
  expired: {
    labelKey: "bounty_status_expired",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  cancelled: {
    labelKey: "bounty_status_cancelled",
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
  const { t } = useLang();
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
    >
      {t(meta.labelKey)}
    </span>
  );
}
