"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { submitReferralAction } from "@/lib/referral/actions";
import { idleAction } from "@/lib/auth/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" disabled={pending}>
      {pending ? "Wird gesendet …" : "Empfehlung absenden"}
    </Button>
  );
}

export function ReferralForm({ bountyId }: { bountyId: string }) {
  const [state, formAction] = useActionState(submitReferralAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="bountyId" value={bountyId} />

      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="candidateName">Name der:s Kandidat:in</Label>
          <Input
            id="candidateName"
            name="candidateName"
            required
            minLength={2}
            maxLength={120}
            invalid={Boolean(fe?.candidateName)}
            aria-describedby={fe?.candidateName ? "cand-name-err" : undefined}
          />
          <FieldError id="cand-name-err" message={fe?.candidateName} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="candidateEmail">E-Mail</Label>
          <Input
            id="candidateEmail"
            name="candidateEmail"
            type="email"
            required
            maxLength={254}
            invalid={Boolean(fe?.candidateEmail)}
            aria-describedby={fe?.candidateEmail ? "cand-email-err" : undefined}
          />
          <FieldError id="cand-email-err" message={fe?.candidateEmail} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="candidateContact">Weitere Kontaktdaten (optional)</Label>
        <Input
          id="candidateContact"
          name="candidateContact"
          placeholder="LinkedIn-URL, Telefonnummer …"
          maxLength={500}
          invalid={Boolean(fe?.candidateContact)}
          aria-describedby={fe?.candidateContact ? "cand-contact-err" : undefined}
        />
        <FieldError id="cand-contact-err" message={fe?.candidateContact} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Nachricht an den:die Bounty-Ersteller:in (optional)</Label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          maxLength={2000}
          placeholder="Warum ist diese Person ein Match? Wie kennst du sie?"
          invalid={Boolean(fe?.message)}
          aria-describedby={fe?.message ? "msg-err" : "msg-help"}
        />
        <FieldError id="msg-err" message={fe?.message} />
        {!fe?.message && (
          <p id="msg-help" className="text-xs text-[var(--color-text-faint)]">
            Max. 2000 Zeichen.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-surface-border)] pt-4">
        <p className="text-xs text-[var(--color-text-faint)]">
          Mit dem Absenden bestätigst du, dass der:die Kandidat:in informiert ist und
          der Weitergabe zustimmt.
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
