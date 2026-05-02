"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useLang } from "@/context/lang-context";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";
import {
  confirmClaimAction,
  confirmDataForwardedAction,
  rejectConfirmationAction,
  openDisputeAction,
  flagApplicationSubmittedAction,
} from "@/lib/referral/confirmations";
import { idleAction } from "@/lib/auth/action-result";
import type { ReferralStatus, RejectionStage } from "@/lib/supabase/types";
import { useState } from "react";
import { Check, Send } from "lucide-react";

function PendingButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/* ── Claim bestätigen ──────────────────────────────────────────────────── */
export function ConfirmClaimButton({ referralId }: { referralId: string }) {
  const { t } = useLang();
  const [state, formAction] = useActionState(confirmClaimAction, idleAction);

  if (state.status === "ok") {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--color-success)]">
        <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        {t("ref_confirm_claim_ok")}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="referralId" value={referralId} />
      <PendingButton
        pendingLabel={t("ref_confirm_pending")}
        label={t("ref_confirm_claim_btn")}
      />
    </form>
  );
}

/* ── Datenweitergabe bestätigen ─────────────────────────────────────────── */
export function ConfirmDataForwardedButton({ referralId }: { referralId: string }) {
  const { t } = useLang();
  const [state, formAction] = useActionState(confirmDataForwardedAction, idleAction);

  if (state.status === "ok") {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--color-success)]">
        <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="referralId" value={referralId} />
      <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[color-mix(in_oklab,var(--color-warning)_8%,transparent)] p-3 text-xs text-[var(--color-text-muted)]">
        <strong className="text-[var(--color-warning)]">{t("ref_data_forward_warn_strong")}</strong>{" "}
        {t("ref_data_forward_warn")}
      </div>
      <PendingButton
        pendingLabel={t("ref_confirm_pending")}
        label={t("ref_data_forward_btn")}
      />
    </form>
  );
}

/* ── Ablehnen (mit Pflicht-Begründung ≥ 50 Zeichen) ───────────────────── */
export function RejectButton({
  referralId,
  stage,
  currentStatus,
}: {
  referralId: string;
  stage: RejectionStage;
  currentStatus: ReferralStatus;
}) {
  const { t } = useLang();
  const [state, formAction] = useActionState(rejectConfirmationAction, idleAction);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (state.status === "ok") {
    return <p className="text-sm text-[var(--color-error)]">{t("ref_reject_done")}</p>;
  }

  if (!open) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        {t("ref_reject_open")}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[color-mix(in_oklab,var(--color-error)_6%,transparent)] p-4">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="referralId" value={referralId} />
      <input type="hidden" name="stage" value={stage} />
      <label className="text-sm font-medium text-[var(--color-text-primary)]">
        {t("ref_reject_reason_label")}
      </label>
      <textarea
        name="reason"
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("ref_reject_reason_ph")}
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-400)]"
        minLength={50}
        maxLength={2000}
      />
      <p className="text-xs text-[var(--color-text-faint)]">
        {t("ref_reject_counter").replace("{n}", String(reason.length))}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs underline text-[var(--color-text-muted)]">
          {t("ref_cancel")}
        </button>
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={reason.length < 50}
        >
          {t("ref_reject_submit")}
        </Button>
      </div>
    </form>
  );
}

/* ── Bewerbung markieren (Kandidat, beendet die anonyme Phase) ───────────
 *
 * Konzept: docs/KONZEPTPLATTFORM-GESCHAEFTSMODELL.md, Abschnitt 4, Schritt 3.
 * Setzt das Bewerbungs-Flag und gibt damit die Kontaktdaten des Kandidaten
 * an den Inserenten frei. Bestätigung in zwei Schritten (Klick → Confirm).
 */
export function FlagApplicationButton({ referralId }: { referralId: string }) {
  const { t } = useLang();
  const [state, formAction] = useActionState(flagApplicationSubmittedAction, idleAction);
  const [confirming, setConfirming] = useState(false);

  if (state.status === "ok") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-success)]">
        <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        {state.message}
      </p>
    );
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {t("ref_application_flag_title")}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t("ref_application_flag_explainer")}
        </p>
        <Button onClick={() => setConfirming(true)} size="sm" className="self-start">
          <Send className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          {t("ref_application_flag_btn")}
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[color-mix(in_oklab,var(--color-warning)_8%,transparent)] p-4"
    >
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="referralId" value={referralId} />
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {t("ref_application_flag_confirm_title")}
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">
        {t("ref_application_flag_confirm_explainer")}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs underline text-[var(--color-text-muted)]"
        >
          {t("ref_cancel")}
        </button>
        <PendingButton
          pendingLabel={t("ref_confirm_pending")}
          label={t("ref_application_flag_confirm_btn")}
        />
      </div>
    </form>
  );
}

/* ── Dispute öffnen (B, nach Ablehnung) ────────────────────────────────── */
export function OpenDisputeButton({ referralId }: { referralId: string }) {
  const { t } = useLang();
  const [state, formAction] = useActionState(openDisputeAction, idleAction);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (state.status === "ok") {
    return <p className="text-sm text-[var(--color-brand-400)]">{state.message}</p>;
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("ref_dispute_open")}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-brand-400)] p-4">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="referralId" value={referralId} />
      <label className="text-sm font-medium text-[var(--color-text-primary)]">
        {t("ref_dispute_reason_label")}
      </label>
      <textarea
        name="reason"
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("ref_dispute_reason_ph")}
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-400)]"
        minLength={50}
        maxLength={2000}
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs underline text-[var(--color-text-muted)]">
          {t("ref_cancel")}
        </button>
        <Button type="submit" size="sm" disabled={reason.length < 50}>
          {t("ref_dispute_submit")}
        </Button>
      </div>
    </form>
  );
}
