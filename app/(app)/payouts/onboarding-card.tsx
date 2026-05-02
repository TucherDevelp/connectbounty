"use client";

import { useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Link2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { startStripeConnectAction } from "@/lib/stripe/actions";
import type { ConnectAccountStatus } from "@/lib/stripe/connect";
import { useLang } from "@/context/lang-context";
import type { TranslationKey } from "@/lib/i18n";

const STATUS_CONFIG: Record<
  ConnectAccountStatus["onboardingStatus"],
  { Icon: LucideIcon; labelKey: TranslationKey; descriptionKey: TranslationKey; color: string }
> = {
  pending: {
    Icon: Link2,
    labelKey: "connect_label_pending",
    descriptionKey: "connect_desc_pending",
    color: "border-[var(--color-brand-400)]/30 bg-[var(--color-brand-400)]/5",
  },
  onboarding: {
    Icon: Loader2,
    labelKey: "connect_label_onboarding",
    descriptionKey: "connect_desc_onboarding",
    color: "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5",
  },
  active: {
    Icon: CheckCircle2,
    labelKey: "connect_label_active",
    descriptionKey: "connect_desc_active",
    color: "border-[var(--color-success)]/30 bg-[var(--color-success)]/5",
  },
  restricted: {
    Icon: AlertTriangle,
    labelKey: "connect_label_restricted",
    descriptionKey: "connect_desc_restricted",
    color: "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5",
  },
  disabled: {
    Icon: Ban,
    labelKey: "connect_label_disabled",
    descriptionKey: "connect_desc_disabled",
    color: "border-[var(--color-error)]/30 bg-[var(--color-error)]/5",
  },
};

interface Props {
  connectStatus: ConnectAccountStatus | null;
  currentlyDue?: string[];
}

export function ConnectOnboardingCard({ connectStatus, currentlyDue }: Props) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();

  const status = connectStatus?.onboardingStatus ?? "pending";
  const config = STATUS_CONFIG[status];
  const Icon = config.Icon;
  const showButton = status !== "active" && status !== "disabled";

  return (
    <div className={`rounded-[var(--radius-lg)] border p-5 ${config.color}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon
            className={`mt-0.5 size-6 shrink-0 text-[var(--color-text-primary)] ${status === "onboarding" ? "animate-spin" : ""}`}
            strokeWidth={1.85}
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(config.labelKey)}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{t(config.descriptionKey)}</p>
            {connectStatus?.stripeAccountId && (
              <p className="mt-1.5 text-xs text-[var(--color-text-faint)]">
                {t("connect_account_id")}{" "}
                <code className="rounded bg-black/20 px-1 py-0.5">{connectStatus.stripeAccountId}</code>
              </p>
            )}
            {currentlyDue && currentlyDue.length > 0 && (
              <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-error)]/10 px-3 py-2">
                <p className="text-xs font-medium text-[var(--color-error)]">
                  {t("connect_req_missing")}
                </p>
                <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-error)]">
                  {currentlyDue.slice(0, 3).map((req) => (
                    <li key={req}>{req.replace(/_/g, " ")}</li>
                  ))}
                  {currentlyDue.length > 3 && (
                    <li>+ {currentlyDue.length - 3} {t("connect_req_more")}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        {showButton && (
          <Button
            type="button"
            size="sm"
            variant={status === "pending" ? "primary" : "secondary"}
            disabled={pending}
            onClick={() => startTransition(() => void startStripeConnectAction())}
          >
            {pending
              ? t("connect_btn_redirecting")
              : status === "pending"
                ? t("connect_btn_connect")
                : t("connect_btn_resume")}
          </Button>
        )}
      </div>
    </div>
  );
}
