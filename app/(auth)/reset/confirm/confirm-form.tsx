"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { updatePasswordAction } from "@/lib/auth/actions";
import { idleAction } from "@/lib/auth/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Wird aktualisiert …" : "Neues Passwort speichern"}
    </Button>
  );
}

export function ConfirmResetForm() {
  const [state, formAction] = useActionState(updatePasswordAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  if (state.status === "ok") {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert variant="success">{state.message}</FormAlert>
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--color-brand-400)] hover:underline"
        >
          Zum Login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Neues Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(fe?.password)}
          aria-describedby={fe?.password ? "password-error" : "password-hint"}
        />
        <FieldError id="password-error" message={fe?.password} />
        {!fe?.password && (
          <p id="password-hint" className="text-xs text-[var(--color-text-faint)]">
            Mindestens 12 Zeichen, davon 3 von 4 Zeichenklassen.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(fe?.confirmPassword)}
          aria-describedby={fe?.confirmPassword ? "confirmPassword-error" : undefined}
        />
        <FieldError id="confirmPassword-error" message={fe?.confirmPassword} />
      </div>

      <SubmitButton />
    </form>
  );
}
