"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startKycAction } from "@/lib/kyc/actions";
import { useLang } from "@/context/lang-context";

export function StartKycButton({ labelKey }: { labelKey?: "kyc_start_btn" | "kyc_restart" }) {
  const { t } = useLang();
  const key = labelKey ?? "kyc_start_btn";
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="lg"
      disabled={pending}
      onClick={() => startTransition(() => void startKycAction())}
    >
      {pending ? t("kyc_start_pending") : t(key)}
    </Button>
  );
}
