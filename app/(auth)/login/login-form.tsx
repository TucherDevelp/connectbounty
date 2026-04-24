"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { loginAction } from "@/lib/auth/actions";
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
          {t("auth_login_pending")}
        </>
      ) : (
        t("auth_login_btn")
      )}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, idleAction);
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {t("auth_welcome_back")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("auth_login_intro")}</p>
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

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">{t("auth_password")}</Label>
            <Link href="/reset" className="text-xs font-medium text-primary hover:underline">
              {t("auth_forgot")}
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

        <div className="relative flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-xs text-muted-foreground">{t("auth_or")}</span>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <GoogleButton label={t("auth_google")} />

        <p className="text-center text-sm text-muted-foreground">
          {t("auth_no_account")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("nav_register")}
          </Link>
        </p>
      </form>
    </div>
  );
}
