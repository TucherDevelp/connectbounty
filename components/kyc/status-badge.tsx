"use client";

import type { KycStatus } from "@/lib/supabase/types";
import type { TranslationKey } from "@/lib/i18n";
import { useLang } from "@/context/lang-context";

const LABELS: Record<KycStatus, { labelKey: TranslationKey; className: string }> = {
  unverified: {
    labelKey: "kyc_badge_unverified",
    className:
      "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-surface-border)]",
  },
  pending: {
    labelKey: "kyc_badge_pending",
    className:
      "border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]",
  },
  approved: {
    labelKey: "kyc_badge_approved",
    className:
      "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]",
  },
  rejected: {
    labelKey: "kyc_badge_rejected",
    className:
      "border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]",
  },
  expired: {
    labelKey: "kyc_badge_expired",
    className:
      "border-[hsl(var(--primary)/0.28)] bg-[var(--color-surface-2)] text-[hsl(var(--accent))]",
  },
};

export function KycStatusBadge({ status }: { status: KycStatus }) {
  const { t } = useLang();
  const { labelKey, className } = LABELS[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${className}`}
    >
      {t(labelKey)}
    </span>
  );
}
