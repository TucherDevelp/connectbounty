"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { refreshStripeStatusAction } from "@/lib/stripe/actions";
import { idleAction } from "@/lib/auth/action-result";
import { useLang } from "@/context/lang-context";

export function RefreshStatusButton() {
  const { t } = useLang();
  const [state, formAction, pending] = useActionState(refreshStripeStatusAction, idleAction);
  void state;

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? t("refresh_status_pending") : t("refresh_status_label")}
      </Button>
    </form>
  );
}
