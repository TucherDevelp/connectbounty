import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReferralStatus } from "@/lib/supabase/types";

type Step = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
};

function getSteps(
  status: ReferralStatus,
  flags: {
    hireProofUploaded: boolean;
    claimConfirmed: boolean;
    payoutAccountConfirmed: boolean;
    dataForwarded: boolean;
  },
  labels: [string, string, string, string],
): Step[] {
  return [
    {
      key: "hire_proof",
      label: labels[0]!,
      done: flags.hireProofUploaded,
      active: status === "awaiting_hire_proof",
    },
    {
      key: "claim",
      label: labels[1]!,
      done: flags.claimConfirmed,
      active: status === "awaiting_claim",
    },
    {
      key: "payout_account",
      label: labels[2]!,
      done: flags.payoutAccountConfirmed,
      active: status === "awaiting_payout_account",
    },
    {
      key: "data_forwarding",
      label: labels[3]!,
      done: flags.dataForwarded,
      active: status === "awaiting_data_forwarding",
    },
  ];
}

export function ThreeStageProgress({
  status,
  hireProofUploaded,
  claimConfirmed,
  payoutAccountConfirmed,
  dataForwarded,
  stepLabels,
}: {
  status: ReferralStatus;
  hireProofUploaded: boolean;
  claimConfirmed: boolean;
  payoutAccountConfirmed: boolean;
  dataForwarded: boolean;
  stepLabels: [string, string, string, string];
}) {
  const steps = getSteps(
    status,
    {
      hireProofUploaded,
      claimConfirmed,
      payoutAccountConfirmed,
      dataForwarded,
    },
    stepLabels,
  );

  return (
    <ol className="flex w-full items-center gap-0">
      {steps.map((step, i) => (
        <li key={step.key} className="flex flex-1 items-center">
          {/* Circle */}
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                step.done
                  ? "bg-[var(--color-success)] text-white"
                  : step.active
                    ? "bg-[var(--color-brand-400)] text-white"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
              )}
            >
              {step.done ? (
                <Check className="size-4" strokeWidth={2.75} aria-hidden />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                "text-center text-xs leading-tight",
                step.done
                  ? "text-[var(--color-success)]"
                  : step.active
                    ? "font-medium text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-faint)]",
              )}
            >
              {step.label}
            </span>
          </div>
          {/* Connector */}
          {i < steps.length - 1 && (
            <div
              className={cn(
                "mb-5 h-0.5 flex-1",
                step.done ? "bg-[var(--color-success)]" : "bg-[var(--color-surface-border)]",
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
