"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { refreshStripeStatusAction } from "@/lib/stripe/actions";
import { idleAction } from "@/lib/auth/action-result";

export function RefreshStatusButton() {
  const [state, formAction, pending] = useActionState(refreshStripeStatusAction, idleAction);
  void state;

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Aktualisiere …" : "Status aktualisieren"}
      </Button>
    </form>
  );
}
