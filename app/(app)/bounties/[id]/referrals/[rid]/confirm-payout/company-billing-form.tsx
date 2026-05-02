"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check } from "lucide-react";
import { useLang } from "@/context/lang-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormAlert, FieldError } from "@/components/ui/form-error";
import { confirmPayoutAccountAction } from "@/lib/referral/confirmations";
import { idleAction } from "@/lib/auth/action-result";

function SubmitButton({ pendingLabel, label }: { pendingLabel: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? pendingLabel : label}
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
  const { t } = useLang();
  const [state, formAction] = useActionState(confirmPayoutAccountAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  if (state.status === "ok") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)] p-6 text-center">
        <p className="flex items-center justify-center gap-2 font-semibold text-[var(--color-success)]">
          <Check className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
          {t("billing_ok_title")}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("billing_ok_body")}</p>
        <div className="mt-4">
          <a
            href={`/bounties/${bountyId}/referrals/${referralId}`}
            className="inline-flex items-center justify-center gap-1.5 text-sm underline text-[var(--color-brand-400)]"
          >
            {t("billing_back")}
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
        <strong className="text-[var(--color-brand-400)]">{t("billing_disclaimer_strong")}</strong>{" "}
        {t("billing_disclaimer")}
      </div>

      {/* Firmenname */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyName">{t("billing_company_name")}</Label>
        <Input
          id="companyName"
          name="companyName"
          placeholder={t("billing_company_ph")}
          required
          maxLength={200}
          invalid={Boolean(fe?.companyName)}
          aria-describedby={fe?.companyName ? "company-name-error" : undefined}
        />
        <FieldError id="company-name-error" message={fe?.companyName} />
      </div>

      {/* E-Mail der Firma */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyEmail">{t("billing_company_email")}</Label>
        <Input
          id="companyEmail"
          name="companyEmail"
          type="email"
          placeholder={t("billing_company_email_ph")}
          required
          invalid={Boolean(fe?.companyEmail)}
          aria-describedby={fe?.companyEmail ? "company-email-error" : undefined}
        />
        <FieldError id="company-email-error" message={fe?.companyEmail} />
      </div>

      {/* Adresse */}
      <fieldset className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4">
        <legend className="px-1 text-sm font-medium text-[var(--color-text-primary)]">
          {t("billing_address_legend")}
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="addressLine1">{t("billing_addr1")}</Label>
          <Input
            id="addressLine1"
            name="addressLine1"
            placeholder={t("billing_addr1_ph")}
            required
            invalid={Boolean(fe?.addressLine1)}
            aria-describedby={fe?.addressLine1 ? "addr1-error" : undefined}
          />
          <FieldError id="addr1-error" message={fe?.addressLine1} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="addressLine2">{t("billing_addr2")}</Label>
          <Input id="addressLine2" name="addressLine2" placeholder={t("billing_addr2_ph")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addressPostalCode">{t("billing_plz")}</Label>
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
            <Label htmlFor="addressCity">{t("billing_city")}</Label>
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
          <Label htmlFor="addressCountry">{t("billing_country")}</Label>
          <Select
            id="addressCountry"
            name="addressCountry"
            defaultValue="DE"
            required
            invalid={Boolean(fe?.addressCountry)}
          >
            <option value="AT">Österreich (AT)</option>
            <option value="BE">Belgien (BE)</option>
            <option value="BG">Bulgarien (BG)</option>
            <option value="CY">Zypern (CY)</option>
            <option value="CZ">Tschechien (CZ)</option>
            <option value="DE">Deutschland (DE)</option>
            <option value="DK">Dänemark (DK)</option>
            <option value="EE">Estland (EE)</option>
            <option value="ES">Spanien (ES)</option>
            <option value="FI">Finnland (FI)</option>
            <option value="FR">Frankreich (FR)</option>
            <option value="GR">Griechenland (GR)</option>
            <option value="HR">Kroatien (HR)</option>
            <option value="HU">Ungarn (HU)</option>
            <option value="IE">Irland (IE)</option>
            <option value="IT">Italien (IT)</option>
            <option value="LT">Litauen (LT)</option>
            <option value="LU">Luxemburg (LU)</option>
            <option value="LV">Lettland (LV)</option>
            <option value="MT">Malta (MT)</option>
            <option value="NL">Niederlande (NL)</option>
            <option value="PL">Polen (PL)</option>
            <option value="PT">Portugal (PT)</option>
            <option value="RO">Rumänien (RO)</option>
            <option value="SE">Schweden (SE)</option>
            <option value="SI">Slowenien (SI)</option>
            <option value="SK">Slowakei (SK)</option>
            <option value="CH">Schweiz (CH)</option>
            <option value="GB">Vereinigtes Königreich (GB)</option>
          </Select>
          <FieldError id="country-error" message={fe?.addressCountry} />
        </div>
      </fieldset>

      {/* USt-ID */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyTaxId">{t("billing_tax")}</Label>
        <Input
          id="companyTaxId"
          name="companyTaxId"
          placeholder="DE123456789"
          maxLength={30}
        />
        <p className="text-xs text-[var(--color-text-faint)]">{t("billing_tax_help")}</p>
      </div>

      <div className="flex justify-end border-t border-[var(--color-surface-border)] pt-6">
        <SubmitButton pendingLabel={t("billing_submit_pending")} label={t("billing_submit")} />
      </div>
    </form>
  );
}
