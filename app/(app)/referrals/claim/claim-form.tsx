"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/context/lang-context";
import type { FormatLocale } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormAlert, FieldError } from "@/components/ui/form-error";
import { claimHireAction } from "@/lib/referral/confirmations";
import { idleAction } from "@/lib/auth/action-result";
import type { BountyListItem } from "@/lib/bounty/queries";

function SubmitButton({ pendingLabel, label }: { pendingLabel: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ClaimForm({
  bounties,
  bonusLocale,
}: {
  bounties: BountyListItem[];
  bonusLocale: FormatLocale;
}) {
  const { t } = useLang();
  const [state, formAction] = useActionState(claimHireAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  if (state.status === "ok") {
    return (
      <div className="rounded-[var(--radius-md)] bg-[color-mix(in_oklab,var(--color-success)_12%,transparent)] border border-[var(--color-success)] p-6 text-center">
        <p className="font-semibold text-[var(--color-success)]">{t("claim_ok_title")}</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("claim_ok_body")}</p>
        <div className="mt-4">
          <Button size="md" variant="outline" onClick={() => window.location.href = `/referrals/${state.message}/upload`}>
            <span className="inline-flex items-center gap-1.5">
              {t("claim_ok_cta")}
              <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            </span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bountyId">{t("claim_bounty_label")}</Label>
        {bounties.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4 text-sm text-[var(--color-text-muted)]">
            {t("claim_no_bounties")}
          </p>
        ) : (
          <select
            id="bountyId"
            name="bountyId"
            required
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-400)]"
            aria-describedby={fe?.bountyId ? "bounty-error" : undefined}
          >
            <option value="">{t("claim_bounty_placeholder")}</option>
            {bounties.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.bonus_amount.toLocaleString(bonusLocale)} {b.bonus_currency})
              </option>
            ))}
          </select>
        )}
        <FieldError id="bounty-error" message={fe?.bountyId} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">{t("claim_note_label")}</Label>
        <Textarea
          id="note"
          name="note"
          rows={3}
          placeholder={t("claim_note_ph")}
          maxLength={500}
          invalid={Boolean(fe?.note)}
          aria-describedby={fe?.note ? "note-error" : "note-help"}
        />
        <FieldError id="note-error" message={fe?.note} />
        {!fe?.note && (
          <p id="note-help" className="text-xs text-[var(--color-text-faint)]">
            {t("claim_note_help")}
          </p>
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[color-mix(in_oklab,var(--color-warning)_8%,transparent)] p-4 text-xs text-[var(--color-text-muted)]">
        <strong className="text-[var(--color-warning)]">{t("claim_disclaimer_strong")}</strong>{" "}
        {t("claim_disclaimer")}
      </div>

      <div className="flex justify-end border-t border-[var(--color-surface-border)] pt-6">
        <SubmitButton pendingLabel={t("claim_submit_pending")} label={t("claim_submit")} />
      </div>
    </form>
  );
}
