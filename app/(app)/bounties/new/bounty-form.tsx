"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { createBountyAction } from "@/lib/bounty/actions";
import { idleAction } from "@/lib/auth/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Speichern …" : "Als Entwurf speichern"}
    </Button>
  );
}

export function BountyForm() {
  const [state, formAction] = useActionState(createBountyAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Titel</Label>
        <Input
          id="title"
          name="title"
          placeholder="z. B. Senior React Engineer (Remote, 100 %)"
          required
          maxLength={120}
          invalid={Boolean(fe?.title)}
          aria-describedby={fe?.title ? "title-error" : "title-help"}
        />
        <FieldError id="title-error" message={fe?.title} />
        {!fe?.title && (
          <p id="title-help" className="text-xs text-[var(--color-text-faint)]">
            5 - 120 Zeichen, prägnant und klar.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Rolle, Anforderungen, Rahmenbedingungen, wer bewertet Empfehlungen …"
          required
          minLength={20}
          maxLength={5000}
          rows={10}
          invalid={Boolean(fe?.description)}
          aria-describedby={fe?.description ? "description-error" : "description-help"}
        />
        <FieldError id="description-error" message={fe?.description} />
        {!fe?.description && (
          <p id="description-help" className="text-xs text-[var(--color-text-faint)]">
            20 - 5000 Zeichen. Markdown-Unterstützung folgt in einer späteren Phase.
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bonusAmount">Prämie</Label>
          <Input
            id="bonusAmount"
            name="bonusAmount"
            type="text"
            inputMode="decimal"
            placeholder="1500"
            required
            invalid={Boolean(fe?.bonusAmount)}
            aria-describedby={fe?.bonusAmount ? "bonus-error" : undefined}
          />
          <FieldError id="bonus-error" message={fe?.bonusAmount} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bonusCurrency">Währung</Label>
          <Input
            id="bonusCurrency"
            name="bonusCurrency"
            type="text"
            defaultValue="EUR"
            maxLength={3}
            required
            invalid={Boolean(fe?.bonusCurrency)}
            aria-describedby={fe?.bonusCurrency ? "currency-error" : undefined}
          />
          <FieldError id="currency-error" message={fe?.bonusCurrency} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Ort (optional)</Label>
          <Input
            id="location"
            name="location"
            placeholder="z. B. Berlin / Remote"
            maxLength={120}
            invalid={Boolean(fe?.location)}
            aria-describedby={fe?.location ? "location-error" : undefined}
          />
          <FieldError id="location-error" message={fe?.location} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="industry">Branche (optional)</Label>
          <Input
            id="industry"
            name="industry"
            placeholder="z. B. Software, Healthcare, Finance"
            maxLength={80}
            invalid={Boolean(fe?.industry)}
            aria-describedby={fe?.industry ? "industry-error" : undefined}
          />
          <FieldError id="industry-error" message={fe?.industry} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags">Tags (optional)</Label>
        <Input
          id="tags"
          name="tags"
          placeholder="react, typescript, backend"
          invalid={Boolean(fe?.tags)}
          aria-describedby={fe?.tags ? "tags-error" : "tags-help"}
        />
        <FieldError id="tags-error" message={fe?.tags} />
        {!fe?.tags && (
          <p id="tags-help" className="text-xs text-[var(--color-text-faint)]">
            Kommagetrennt, max. 10. Nur Buchstaben, Ziffern, <code>-</code> <code>.</code>{" "}
            <code>_</code>.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expiresAt">Ablaufdatum (optional)</Label>
        <Input
          id="expiresAt"
          name="expiresAt"
          type="datetime-local"
          invalid={Boolean(fe?.expiresAt)}
          aria-describedby={fe?.expiresAt ? "expires-error" : "expires-help"}
        />
        <FieldError id="expires-error" message={fe?.expiresAt} />
        {!fe?.expiresAt && (
          <p id="expires-help" className="text-xs text-[var(--color-text-faint)]">
            Nach diesem Zeitpunkt wird die Bounty automatisch auf <code>expired</code> gesetzt.
          </p>
        )}
      </div>

      {/* ── Split-Konfiguration (40/40/20 BPS) ── */}
      <fieldset className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4">
        <legend className="px-1 text-sm font-medium text-[var(--color-text-primary)]">
          Auszahlungs-Split
        </legend>
        <p className="text-xs text-[var(--color-text-faint)]">
          Basis-Punkte (BPS): Summe muss 10 000 ergeben (= 100 %). Standard: 40 % Inserent · 40 % Kandidat · 20 % Plattform.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="splitReferrerBps">Inserent A (BPS)</Label>
            <Input
              id="splitReferrerBps"
              name="splitReferrerBps"
              type="number"
              min={0}
              max={9500}
              defaultValue={4000}
              required
              invalid={Boolean(fe?.splitReferrerBps)}
              aria-describedby={fe?.splitReferrerBps ? "split-a-error" : undefined}
            />
            <FieldError id="split-a-error" message={fe?.splitReferrerBps} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="splitCandidateBps">Kandidat B (BPS)</Label>
            <Input
              id="splitCandidateBps"
              name="splitCandidateBps"
              type="number"
              min={0}
              max={9500}
              defaultValue={4000}
              required
              invalid={Boolean(fe?.splitCandidateBps)}
              aria-describedby={fe?.splitCandidateBps ? "split-b-error" : undefined}
            />
            <FieldError id="split-b-error" message={fe?.splitCandidateBps} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="splitPlatformBps">Plattform (BPS)</Label>
            <Input
              id="splitPlatformBps"
              name="splitPlatformBps"
              type="number"
              min={500}
              max={10000}
              defaultValue={2000}
              required
              invalid={Boolean(fe?.splitPlatformBps)}
              aria-describedby={fe?.splitPlatformBps ? "split-p-error" : undefined}
            />
            <FieldError id="split-p-error" message={fe?.splitPlatformBps} />
          </div>
        </div>
        {state.status === "error" && fe?._root && (
          <FormAlert>{fe._root}</FormAlert>
        )}
      </fieldset>

      {/* ── Payment-Mode ── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paymentMode">Zahlungsmodus</Label>
        <select
          id="paymentMode"
          name="paymentMode"
          defaultValue="on_confirmation"
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-400)]"
        >
          <option value="on_confirmation">Standard - Zahlung nach Bestätigung (Rechnung an Firma)</option>
          <option value="escrow">Escrow - Betrag wird beim Veröffentlichen reserviert</option>
        </select>
        <p className="text-xs text-[var(--color-text-faint)]">
          Im Standard-Modus erhält die Firma nach Abschluss aller Bestätigungen eine Stripe-Rechnung.
          Im Escrow-Modus wird der Betrag sofort per Karte reserviert und erst nach Bestätigung abgebucht.
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-surface-border)] pt-6">
        <p className="text-xs text-[var(--color-text-faint)]">
          Wird zunächst als Entwurf gespeichert. Veröffentlichen im nächsten Schritt.
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
