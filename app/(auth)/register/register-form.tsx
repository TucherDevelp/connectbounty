"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { registerAction } from "@/lib/auth/actions";
import { idleAction } from "@/lib/auth/action-result";
import { GoogleButton } from "@/components/auth/google-button";
import { useLang } from "@/context/lang-context";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useLang();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full min-h-11">
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          {t("auth_register_pending")}
        </>
      ) : (
        t("auth_register_btn")
      )}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const { t } = useLang();

  if (state.status === "ok") {
    return <FormAlert variant="success">{state.message}</FormAlert>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {t("auth_register_title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("auth_register_intro")}</p>
      </header>

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">{t("auth_display_name")}</Label>
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t("auth_password")}</Label>
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

        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="terms"
            required
            className="mt-1 h-4 w-4 rounded border-border/60 bg-surface-2 accent-primary"
          />
          <span>
            {t("auth_terms_intro")}{" "}
            <Link href="/legal/terms" className="font-medium text-primary hover:underline">
              {t("footer_terms")}
            </Link>{" "}
            {t("auth_terms_join")}{" "}
            <Link href="/legal/privacy" className="font-medium text-primary hover:underline">
              {t("footer_privacy")}
            </Link>
            .
          </span>
        </label>
        <FieldError message={fe?.terms} />

        <SubmitButton />

        <div className="relative flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-xs text-muted-foreground">{t("auth_or")}</span>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <GoogleButton label={t("auth_google_register")} />

        <p className="text-center text-sm text-muted-foreground">
          {t("auth_has_account")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth_login_btn")}
          </Link>
        </p>
      </form>
    </div>
  );
}
