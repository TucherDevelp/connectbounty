"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";
import { simulateKycDecisionAction } from "@/lib/kyc/actions";
import { idleAction } from "@/lib/auth/action-result";

/**
 * Dev-only UI-Panel: löst die drei möglichen Webhook-Events aus (approve,
 * reject, expire). Im Produktions-Build rendert die Seite dieses Panel
 * gar nicht erst (NODE_ENV-Check im Server-Render von /kyc).
 */
export function KycSimulator({ applicantId }: { applicantId: string }) {
  const [state, formAction] = useActionState(simulateKycDecisionAction, idleAction);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="applicantId" value={applicantId} />
      {state.status === "ok" && <FormAlert variant="success">{state.message}</FormAlert>}
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}

      <div className="flex flex-wrap gap-2">
        <DecisionButton decision="approve" variant="primary">
          Approve
        </DecisionButton>
        <DecisionButton decision="reject" variant="destructive">
          Reject
        </DecisionButton>
        <DecisionButton decision="expire" variant="secondary">
          Expire
        </DecisionButton>
      </div>
    </form>
  );
}

function DecisionButton({
  decision,
  variant,
  children,
}: {
  decision: "approve" | "reject" | "expire";
  variant: "primary" | "secondary" | "destructive";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending}
      name="decision"
      value={decision}
    >
      {children}
    </Button>
  );
}
