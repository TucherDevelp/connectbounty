"use client";

import { useActionState } from "react";
import { requestCurrentUserPasswordResetAction } from "@/lib/auth/actions";
import { idleAction } from "@/lib/auth/action-result";
import { useLang } from "@/context/lang-context";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";

export function SecurityActions() {
  const { t } = useLang();
  const [state, formAction] = useActionState(requestCurrentUserPasswordResetAction, idleAction);

  return (
    <div className="space-y-3">
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      {state.status === "ok" && <FormAlert variant="success">{state.message}</FormAlert>}

      <form action={formAction}>
        <Button type="submit" variant="secondary">
          {t("security_send_password_reset")}
        </Button>
      </form>
    </div>
  );
}
