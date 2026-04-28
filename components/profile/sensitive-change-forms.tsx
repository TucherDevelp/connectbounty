"use client";

import { useActionState } from "react";
import {
  changeAddressWith2faAction,
  changeEmailWith2faAction,
  changePhoneWith2faAction,
} from "@/lib/auth/actions";
import { idleAction } from "@/lib/auth/action-result";
import { useLang } from "@/context/lang-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError, FormAlert } from "@/components/ui/form-error";

export function SensitiveChangeForms({
  initialEmail,
  initialPhone,
  initialAddress,
}: {
  initialEmail: string;
  initialPhone: string;
  initialAddress: {
    line1: string;
    line2: string;
    postalCode: string;
    city: string;
    country: string;
  };
}) {
  const { t } = useLang();
  const [emailState, emailAction] = useActionState(changeEmailWith2faAction, idleAction);
  const [phoneState, phoneAction] = useActionState(changePhoneWith2faAction, idleAction);
  const [addressState, addressAction] = useActionState(changeAddressWith2faAction, idleAction);

  const emailErrors = emailState.status === "error" ? emailState.fieldErrors : undefined;
  const phoneErrors = phoneState.status === "error" ? phoneState.fieldErrors : undefined;
  const addressErrors = addressState.status === "error" ? addressState.fieldErrors : undefined;

  return (
    <div className="space-y-6">
      <form action={emailAction} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4">
        <Label htmlFor="newEmail">{t("security_change_email_label")}</Label>
        <Input id="newEmail" name="newEmail" type="email" placeholder="name@example.com" defaultValue={initialEmail} />
        <FieldError message={emailErrors?.newEmail} />
        {emailState.status === "error" && <FormAlert>{emailState.message}</FormAlert>}
        {emailState.status === "ok" && <FormAlert variant="success">{emailState.message}</FormAlert>}
        <Button type="submit" variant="secondary">{t("security_change_email_button")}</Button>
      </form>

      <form action={phoneAction} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4">
        <Label htmlFor="newPhone">{t("security_change_phone_label")}</Label>
        <Input id="newPhone" name="newPhone" type="tel" placeholder="+491701234567" defaultValue={initialPhone} />
        <FieldError message={phoneErrors?.newPhone} />
        {phoneState.status === "error" && <FormAlert>{phoneState.message}</FormAlert>}
        {phoneState.status === "ok" && <FormAlert variant="success">{phoneState.message}</FormAlert>}
        <Button type="submit" variant="secondary">{t("security_change_phone_button")}</Button>
      </form>

      <form action={addressAction} className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4">
        <Label htmlFor="addressLine1">{t("security_change_address_line1")}</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={initialAddress.line1} />

        <Label htmlFor="addressLine2">{t("security_change_address_line2")}</Label>
        <Input id="addressLine2" name="addressLine2" defaultValue={initialAddress.line2} />

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="postalCode">{t("security_change_address_postal")}</Label>
            <Input id="postalCode" name="postalCode" defaultValue={initialAddress.postalCode} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="city">{t("security_change_address_city")}</Label>
            <Input id="city" name="city" defaultValue={initialAddress.city} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="country">{t("security_change_address_country")}</Label>
          <Input id="country" name="country" maxLength={2} placeholder="DE" defaultValue={initialAddress.country} />
        </div>

        {addressState.status === "error" && <FormAlert>{addressState.message}</FormAlert>}
        {addressState.status === "ok" && <FormAlert variant="success">{addressState.message}</FormAlert>}
        <Button type="submit" variant="secondary">{t("security_change_address_button")}</Button>
      </form>
    </div>
  );
}
