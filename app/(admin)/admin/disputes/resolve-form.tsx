"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { FormAlert, FieldError } from "@/components/ui/form-error";
import { resolveDisputeAction } from "@/lib/dispute/actions";
import { idleAction } from "@/lib/auth/action-result";
import { useLang } from "@/context/lang-context";

export function ResolveForm({ disputeId }: { disputeId: string }) {
  const { t } = useLang();
  const [state, formAction] = useActionState(resolveDisputeAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const [resolution, setResolution] = useState("");

  if (state.status === "ok") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-success)]">
        <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="disputeId" value={disputeId} />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--color-text-muted)]">
          {t("admin_disputes_resolution_label")}
        </label>
        <textarea
          name="resolution"
          rows={3}
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder={t("admin_disputes_resolution_placeholder")}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-400)]"
          minLength={20}
          maxLength={2000}
        />
        <FieldError id={`res-err-${disputeId}`} message={fe?.resolution} />
      </div>

      <div className="flex gap-2">
        {/* Zugunsten des Kandidaten */}
        <button
          formAction={formAction}
          name="decision"
          value="pay"
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-success)] px-3 py-1.5 text-xs font-medium text-[var(--color-success)] hover:bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)]"
          disabled={resolution.length < 20}
        >
          {t("admin_disputes_btn_confirm_pay")}
        </button>
        {/* Dispute abweisen */}
        <button
          formAction={formAction}
          name="decision"
          value="reject"
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-error)] px-3 py-1.5 text-xs font-medium text-[var(--color-error)] hover:bg-[color-mix(in_oklab,var(--color-error)_6%,transparent)]"
          disabled={resolution.length < 20}
        >
          {t("admin_disputes_btn_reject")}
        </button>
      </div>
      <FieldError id={`dec-err-${disputeId}`} message={fe?.decision} />
    </form>
  );
}
