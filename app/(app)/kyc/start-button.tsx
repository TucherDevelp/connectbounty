"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startKycAction } from "@/lib/kyc/actions";

export function StartKycButton({ label = "Verifizierung starten" }: { label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="lg"
      disabled={pending}
      onClick={() => startTransition(() => void startKycAction())}
    >
      {pending ? "Wird gestartet …" : label}
    </Button>
  );
}
