"use client";

import { cn } from "@/lib/utils";
import type { ReferralStatus } from "@/lib/supabase/types";
import { useLang } from "@/context/lang-context";
import type { TranslationKey } from "@/lib/i18n";

const STATUS_META: Record<ReferralStatus, { labelKey: TranslationKey; className: string }> = {
  pending_review: {
    labelKey: "referral_status_pending_review",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  submitted: {
    labelKey: "referral_status_submitted",
    className: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  },
  contacted: {
    labelKey: "referral_status_contacted",
    className:
      "bg-[color-mix(in_oklab,var(--color-info,var(--color-brand))_18%,transparent)] text-[var(--color-brand)]",
  },
  interviewing: {
    labelKey: "referral_status_interviewing",
    className: "bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] text-[var(--color-brand)]",
  },
  hired: {
    labelKey: "referral_status_hired",
    className: "bg-[color-mix(in_oklab,var(--color-success)_22%,transparent)] text-[var(--color-success)]",
  },
  paid: {
    labelKey: "referral_status_paid",
    className: "bg-[color-mix(in_oklab,var(--color-success)_28%,transparent)] text-[var(--color-success)]",
  },
  rejected: {
    labelKey: "referral_status_rejected",
    className: "bg-[color-mix(in_oklab,var(--color-error)_18%,transparent)] text-[var(--color-error)]",
  },
  withdrawn: {
    labelKey: "referral_status_withdrawn",
    className: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  },
  awaiting_hire_proof: {
    labelKey: "referral_status_awaiting_hire_proof",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  awaiting_claim: {
    labelKey: "referral_status_awaiting_claim",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  awaiting_payout_account: {
    labelKey: "referral_status_awaiting_payout_account",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  awaiting_data_forwarding: {
    labelKey: "referral_status_awaiting_data_forwarding",
    className: "bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  },
  invoice_pending: {
    labelKey: "referral_status_invoice_pending",
    className: "bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] text-[var(--color-brand)]",
  },
  invoice_paid: {
    labelKey: "referral_status_invoice_paid",
    className: "bg-[color-mix(in_oklab,var(--color-success)_22%,transparent)] text-[var(--color-success)]",
  },
  disputed: {
    labelKey: "referral_status_disputed",
    className: "bg-[color-mix(in_oklab,var(--color-error)_18%,transparent)] text-[var(--color-error)]",
  },
};

export function ReferralStatusBadge({
  status,
  className,
}: {
  status: ReferralStatus;
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
