"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { idleAction } from "@/lib/auth/action-result";
import { useLang } from "@/context/lang-context";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useLang();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full min-h-11">
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          {t("auth_reset_sending")}
        </>
      ) : (
        t("auth_reset_send_link")
      )}
    </Button>
  );
}

export function RequestResetForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const { t } = useLang();

  if (state.status === "ok") {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {t("auth_reset_title")}
          </h1>
        </header>
        <div className="flex flex-col gap-4">
          <FormAlert variant="success">{state.message}</FormAlert>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("auth_back_login")}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {t("auth_reset_title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("auth_reset_intro_long")}</p>
      </header>

      <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t("auth_email")}</Label>
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

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("auth_back_login")}
        </Link>
      </p>
    </form>
    </div>
  );
}
