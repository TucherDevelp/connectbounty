"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { updatePasswordAction } from "@/lib/auth/actions";
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
          {t("auth_reset_updating")}
        </>
      ) : (
        t("auth_reset_save_password")
      )}
    </Button>
  );
}

export function ConfirmResetForm() {
  const [state, formAction] = useActionState(updatePasswordAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const { t } = useLang();

  if (state.status === "ok") {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {t("auth_reset_confirm_title")}
          </h1>
        </header>
        <div className="flex flex-col gap-4">
          <FormAlert variant="success">{state.message}</FormAlert>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            {t("auth_to_login")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {t("auth_reset_confirm_title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("auth_reset_confirm_page_intro")}</p>
      </header>

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t("auth_new_password")}</Label>
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
            <p id="password-hint" className="text-xs text-muted-foreground">
              {t("auth_password_hint")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">{t("auth_password_confirm")}</Label>
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
    </div>
  );
}
