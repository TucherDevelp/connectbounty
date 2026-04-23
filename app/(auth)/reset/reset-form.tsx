"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { idleAction } from "@/lib/auth/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Wird gesendet …" : "Reset-Link senden"}
    </Button>
  );
}

export function RequestResetForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  if (state.status === "ok") {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert variant="success">{state.message}</FormAlert>
        <p className="text-sm text-[var(--color-text-muted)]">
          <Link
            href="/login"
            className="font-medium text-[var(--color-brand-400)] hover:underline"
          >
            Zurück zum Login
          </Link>
        </p>
      </div>
    );
  }

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

      <SubmitButton />

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        <Link href="/login" className="font-medium text-[var(--color-brand-400)] hover:underline">
          Zurück zum Login
        </Link>
      </p>
    </form>
  );
}
