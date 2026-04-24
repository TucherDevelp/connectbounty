"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert, FieldError } from "@/components/ui/form-error";
import { confirmPayoutAccountAction } from "@/lib/referral/confirmations";
import { idleAction } from "@/lib/auth/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Firmendaten bestätigen & weiter"}
    </Button>
  );
}

export function CompanyBillingForm({
  referralId,
  bountyId,
}: {
  referralId: string;
  bountyId: string;
}) {
  const [state, formAction] = useActionState(confirmPayoutAccountAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  if (state.status === "ok") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)] p-6 text-center">
        <p className="flex items-center justify-center gap-2 font-semibold text-[var(--color-success)]">
          <Check className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
          Firmendaten gespeichert
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Bestätige im letzten Schritt, dass du der Firma das Plattform-Stripe-Konto mitgeteilt hast.
        </p>
        <div className="mt-4">
          <a
            href={`/bounties/${bountyId}/referrals/${referralId}`}
            className="inline-flex items-center justify-center gap-1.5 text-sm underline text-[var(--color-brand-400)]"
          >
            Zurück zum Referral
            <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}
      <input type="hidden" name="referralId" value={referralId} />

      {/* ── Disclaimer ── */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-brand-400)] bg-[color-mix(in_oklab,var(--color-brand-400)_6%,transparent)] p-4 text-sm text-[var(--color-text-muted)]">
        <strong className="text-[var(--color-brand-400)]">Wichtiger Hinweis:</strong>{" "}
        Die Firma erhält eine Stripe-Rechnung über die Plattform. Teile der Firma mit, dass die
        Zahlung direkt über ConnectBounty (Stripe) abgewickelt wird. Die Prämie wird
        nach Zahlungseingang automatisch aufgeteilt. Aus steuerlichen Gründen ist dies
        der einzig zulässige Zahlungsweg.
      </div>

      {/* Firmenname */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyName">Firmenname *</Label>
        <Input
          id="companyName"
          name="companyName"
          placeholder="Acme GmbH"
          required
          maxLength={200}
          invalid={Boolean(fe?.companyName)}
          aria-describedby={fe?.companyName ? "company-name-error" : undefined}
        />
        <FieldError id="company-name-error" message={fe?.companyName} />
      </div>

      {/* E-Mail der Firma */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyEmail">Rechnungs-E-Mail der Firma *</Label>
        <Input
          id="companyEmail"
          name="companyEmail"
          type="email"
          placeholder="buchhaltung@acme.de"
          required
          invalid={Boolean(fe?.companyEmail)}
          aria-describedby={fe?.companyEmail ? "company-email-error" : undefined}
        />
        <FieldError id="company-email-error" message={fe?.companyEmail} />
      </div>

      {/* Adresse */}
      <fieldset className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4">
        <legend className="px-1 text-sm font-medium text-[var(--color-text-primary)]">Rechnungsadresse *</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="addressLine1">Straße + Hausnummer</Label>
          <Input
            id="addressLine1"
            name="addressLine1"
            placeholder="Musterstraße 1"
            required
            invalid={Boolean(fe?.addressLine1)}
            aria-describedby={fe?.addressLine1 ? "addr1-error" : undefined}
          />
          <FieldError id="addr1-error" message={fe?.addressLine1} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="addressLine2">Adresszusatz (optional)</Label>
          <Input id="addressLine2" name="addressLine2" placeholder="c/o, Etage, …" />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addressPostalCode">PLZ</Label>
            <Input
              id="addressPostalCode"
              name="addressPostalCode"
              placeholder="10115"
              required
              invalid={Boolean(fe?.addressPostalCode)}
            />
            <FieldError id="plz-error" message={fe?.addressPostalCode} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addressCity">Stadt</Label>
            <Input
              id="addressCity"
              name="addressCity"
              placeholder="Berlin"
              required
              invalid={Boolean(fe?.addressCity)}
            />
            <FieldError id="city-error" message={fe?.addressCity} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="addressCountry">Land (ISO-Code)</Label>
          <Input
            id="addressCountry"
            name="addressCountry"
            placeholder="DE"
            maxLength={2}
            defaultValue="DE"
            required
            invalid={Boolean(fe?.addressCountry)}
          />
          <FieldError id="country-error" message={fe?.addressCountry} />
        </div>
      </fieldset>

      {/* USt-ID */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyTaxId">USt-IdNr. (optional)</Label>
        <Input
          id="companyTaxId"
          name="companyTaxId"
          placeholder="DE123456789"
          maxLength={30}
        />
        <p className="text-xs text-[var(--color-text-faint)]">
          EU-Umsatzsteuer-Identifikationsnummer. Wird auf der Rechnung ausgewiesen.
        </p>
      </div>

      <div className="flex justify-end border-t border-[var(--color-surface-border)] pt-6">
        <SubmitButton />
      </div>
    </form>
  );
}
