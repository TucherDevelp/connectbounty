"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";
import {
  confirmClaimAction,
  confirmDataForwardedAction,
  rejectConfirmationAction,
  openDisputeAction,
} from "@/lib/referral/confirmations";
import { idleAction } from "@/lib/auth/action-result";
import type { ReferralStatus, RejectionStage } from "@/lib/supabase/types";
import { useState } from "react";
import { Check } from "lucide-react";

function PendingButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird gespeichert …" : label}
    </Button>
  );
}

/* ── Claim bestätigen ──────────────────────────────────────────────────── */
export function ConfirmClaimButton({ referralId }: { referralId: string }) {
  const [state, formAction] = useActionState(confirmClaimAction, idleAction);

  if (state.status === "ok") {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--color-success)]">
        <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        Claim bestätigt
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="referralId" value={referralId} />
      <PendingButton label="Claim bestätigen - Ja, das ist meine Vermittlung" />
    </form>
  );
}

/* ── Datenweitergabe bestätigen ─────────────────────────────────────────── */
export function ConfirmDataForwardedButton({ referralId }: { referralId: string }) {
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
        <strong className="text-[var(--color-warning)]">Wichtig:</strong> Mit dieser Bestätigung versicherst du,
        dass du der Firma das Plattform-Stripe-Konto als Zahlungsempfänger mitgeteilt hast.
        Die Firma erhält anschließend eine Rechnung über die Plattform.
      </div>
      <PendingButton label="Ich habe die Daten weitergeleitet & Stripe-Konto angegeben" />
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
  const [state, formAction] = useActionState(rejectConfirmationAction, idleAction);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (state.status === "ok") {
    return <p className="text-sm text-[var(--color-error)]">Abgelehnt und protokolliert.</p>;
  }

  if (!open) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Ablehnen
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[color-mix(in_oklab,var(--color-error)_6%,transparent)] p-4">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="referralId" value={referralId} />
      <input type="hidden" name="stage" value={stage} />
      <label className="text-sm font-medium text-[var(--color-text-primary)]">
        Pflichtbegründung (min. 50 Zeichen)
      </label>
      <textarea
        name="reason"
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Begründe die Ablehnung ausführlich …"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-400)]"
        minLength={50}
        maxLength={2000}
      />
      <p className="text-xs text-[var(--color-text-faint)]">
        {reason.length}/2000 Zeichen (min. 50 erforderlich)
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs underline text-[var(--color-text-muted)]">
          Abbrechen
        </button>
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={reason.length < 50}
        >
          Ablehnung bestätigen
        </Button>
      </div>
    </form>
  );
}

/* ── Dispute öffnen (B, nach Ablehnung) ────────────────────────────────── */
export function OpenDisputeButton({ referralId }: { referralId: string }) {
  const [state, formAction] = useActionState(openDisputeAction, idleAction);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (state.status === "ok") {
    return <p className="text-sm text-[var(--color-brand-400)]">{state.message}</p>;
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Dispute eröffnen
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-brand-400)] p-4">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="referralId" value={referralId} />
      <label className="text-sm font-medium text-[var(--color-text-primary)]">
        Begründung (min. 50 Zeichen)
      </label>
      <textarea
        name="reason"
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Warum stimmst du der Ablehnung nicht zu?"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-400)]"
        minLength={50}
        maxLength={2000}
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs underline text-[var(--color-text-muted)]">
          Abbrechen
        </button>
        <Button type="submit" size="sm" disabled={reason.length < 50}>
          Dispute einreichen
        </Button>
      </div>
    </form>
  );
}
