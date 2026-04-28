"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-error";
import { useLang } from "@/context/lang-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type MfaState = {
  verifiedFactorId: string | null;
  aal: "aal1" | "aal2";
};

export function MfaVerifyCard() {
  const { t } = useLang();
  const [state, setState] = useState<MfaState>({ verifiedFactorId: null, aal: "aal1" });
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const sb = getSupabaseBrowserClient();
      const [{ data: factorData }, { data: aalData }] = await Promise.all([
        sb.auth.mfa.listFactors(),
        sb.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (!mounted) return;
      const verifiedTotp = factorData?.totp.find((f) => f.status === "verified") ?? null;
      setState({
        verifiedFactorId: verifiedTotp?.id ?? null,
        aal: (aalData?.currentLevel as "aal1" | "aal2" | undefined) ?? "aal1",
      });
      setLoading(false);
    };
    load().catch(() => {
      if (!mounted) return;
      setError(t("security_mfa_load_failed"));
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [t]);

  const verify = async () => {
    setMessage(null);
    setError(null);
    const factorId = state.verifiedFactorId;
    if (!factorId) {
      setError(t("security_mfa_setup_required"));
      return;
    }
    const sb = getSupabaseBrowserClient();
    const { error: verifyError } = await sb.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    if (verifyError) {
      setError(t("security_mfa_verify_failed"));
      return;
    }
    setMessage(t("security_mfa_verify_success"));
    setCode("");
    const { data: aalData } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    setState((prev) => ({
      ...prev,
      aal: (aalData?.currentLevel as "aal1" | "aal2" | undefined) ?? prev.aal,
    }));
  };

  if (loading) {
    return <p className="text-sm text-[var(--color-text-muted)]">{t("security_mfa_loading")}</p>;
  }

  return (
    <div className="space-y-3">
      {error && <FormAlert>{error}</FormAlert>}
      {message && <FormAlert variant="success">{message}</FormAlert>}

      <p className="text-sm text-[var(--color-text-muted)]">
        {state.aal === "aal2" ? t("security_mfa_already_verified") : t("security_mfa_not_verified")}
      </p>

      {state.verifiedFactorId ? (
        <div className="space-y-2">
          <Label htmlFor="mfaCode">{t("security_mfa_code_label")}</Label>
          <div className="flex gap-2">
            <Input
              id="mfaCode"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
            />
            <Button type="button" onClick={verify}>
              {t("security_mfa_verify_button")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">{t("security_mfa_setup_required")}</p>
      )}
    </div>
  );
}
