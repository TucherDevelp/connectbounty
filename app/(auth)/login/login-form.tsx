"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { loginAction } from "@/lib/auth/actions";
import { idleAction } from "@/lib/auth/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Anmelden …" : "Anmelden"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Passwort</Label>
          <Link
            href="/reset"
            className="text-xs font-medium text-[var(--color-brand-400)] hover:underline"
          >
            Passwort vergessen?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(fe?.password)}
          aria-describedby={fe?.password ? "password-error" : undefined}
        />
        <FieldError id="password-error" message={fe?.password} />
      </div>

      <SubmitButton />

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Noch kein Konto?{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--color-brand-400)] hover:underline"
        >
          Jetzt registrieren
        </Link>
      </p>
    </form>
  );
}
