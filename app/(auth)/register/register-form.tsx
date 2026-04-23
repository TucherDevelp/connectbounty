"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { registerAction } from "@/lib/auth/actions";
import { idleAction } from "@/lib/auth/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Konto wird erstellt …" : "Konto erstellen"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  if (state.status === "ok") {
    return <FormAlert variant="success">{state.message}</FormAlert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Anzeigename</Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="nickname"
          required
          minLength={2}
          maxLength={64}
          invalid={Boolean(fe?.displayName)}
          aria-describedby={fe?.displayName ? "displayName-error" : undefined}
        />
        <FieldError id="displayName-error" message={fe?.displayName} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          invalid={Boolean(fe?.email)}
          aria-describedby={fe?.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" message={fe?.email} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Passwort</Label>
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
        <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
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

      <label className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
        <input
          type="checkbox"
          name="terms"
          required
          className="mt-1 h-4 w-4 rounded border-[var(--color-surface-border)] bg-[var(--color-surface-2)] accent-[var(--color-brand-400)]"
        />
        <span>
          Ich akzeptiere die{" "}
          <Link href="/legal/terms" className="text-[var(--color-brand-400)] hover:underline">
            Nutzungsbedingungen
          </Link>{" "}
          und die{" "}
          <Link href="/legal/privacy" className="text-[var(--color-brand-400)] hover:underline">
            Datenschutzerklärung
          </Link>
          .
        </span>
      </label>
      <FieldError message={fe?.terms} />

      <SubmitButton />

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Bereits ein Konto?{" "}
        <Link href="/login" className="font-medium text-[var(--color-brand-400)] hover:underline">
          Anmelden
        </Link>
      </p>
    </form>
  );
}
