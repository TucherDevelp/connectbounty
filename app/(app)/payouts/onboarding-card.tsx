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

const STATUS_CONFIG: Record<
  ConnectAccountStatus["onboardingStatus"],
  { Icon: LucideIcon; label: string; description: string; color: string }
> = {
  pending: {
    Icon: Link2,
    label: "Stripe-Konto verbinden",
    description: "Verbinde dein Bankkonto, um Prämien-Auszahlungen zu empfangen.",
    color: "border-[var(--color-brand-400)]/30 bg-[var(--color-brand-400)]/5",
  },
  onboarding: {
    Icon: Loader2,
    label: "Onboarding läuft",
    description: "Du hast das Onboarding gestartet, aber noch nicht abgeschlossen. Bitte vervollständige alle Angaben.",
    color: "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5",
  },
  active: {
    Icon: CheckCircle2,
    label: "Stripe-Konto aktiv",
    description: "Dein Konto ist verifiziert. Auszahlungen werden automatisch verarbeitet.",
    color: "border-[var(--color-success)]/30 bg-[var(--color-success)]/5",
  },
  restricted: {
    Icon: AlertTriangle,
    label: "Konto eingeschränkt",
    description: "Stripe benötigt zusätzliche Informationen. Bitte schließe das Onboarding ab.",
    color: "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5",
  },
  disabled: {
    Icon: Ban,
    label: "Konto deaktiviert",
    description: "Dein Stripe-Konto wurde deaktiviert. Bitte kontaktiere den Support.",
    color: "border-[var(--color-error)]/30 bg-[var(--color-error)]/5",
  },
};

interface Props {
  connectStatus: ConnectAccountStatus | null;
}

export function ConnectOnboardingCard({ connectStatus }: Props) {
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
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{config.label}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{config.description}</p>
            {connectStatus?.stripeAccountId && (
              <p className="mt-1.5 text-xs text-[var(--color-text-faint)]">
                Account-ID:{" "}
                <code className="rounded bg-black/20 px-1 py-0.5">{connectStatus.stripeAccountId}</code>
              </p>
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
              ? "Weiterleitung …"
              : status === "pending"
              ? "Jetzt verbinden"
              : "Onboarding fortsetzen"}
          </Button>
        )}
      </div>
    </div>
  );
}
