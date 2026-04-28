"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-error";
import { useLang } from "@/context/lang-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type EnrollmentState = {
  factorId: string;
  qrCode: string;
};

export function MfaSetupCard() {
  const { t } = useLang();
  const [state, setState] = useState<EnrollmentState | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const startSetup = async () => {
    setError(null);
    setMessage(null);
    const sb = getSupabaseBrowserClient();
    const { data, error: enrollError } = await sb.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "ConnectBounty Authenticator",
    });
    if (enrollError || !data?.id || !data.totp?.qr_code) {
      setError(t("security_mfa_enroll_failed"));
      return;
    }
    setState({ factorId: data.id, qrCode: data.totp.qr_code });
  };

  const finishSetup = async () => {
    if (!state) return;
    setError(null);
    setMessage(null);
    const sb = getSupabaseBrowserClient();
    const { error: verifyError } = await sb.auth.mfa.challengeAndVerify({
      factorId: state.factorId,
      code: code.trim(),
    });
    if (verifyError) {
      setError(t("security_mfa_verify_failed"));
      return;
    }
    setMessage(t("security_mfa_enroll_success"));
    setState(null);
    setCode("");
  };

  return (
    <div className="space-y-3">
      {error && <FormAlert>{error}</FormAlert>}
      {message && <FormAlert variant="success">{message}</FormAlert>}

      {!state ? (
        <Button type="button" variant="secondary" onClick={startSetup}>
          {t("security_mfa_start_setup")}
        </Button>
      ) : (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">{t("security_mfa_scan_qr")}</p>
          <div
            className="w-fit rounded bg-white p-2"
            dangerouslySetInnerHTML={{ __html: state.qrCode }}
          />
          <Label htmlFor="setupCode">{t("security_mfa_code_label")}</Label>
          <div className="flex gap-2">
            <Input
              id="setupCode"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
            />
            <Button type="button" onClick={finishSetup}>
              {t("security_mfa_finish_setup")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
