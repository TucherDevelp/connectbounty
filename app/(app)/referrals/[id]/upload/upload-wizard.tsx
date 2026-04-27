"use client";

import { useState, useRef, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { useLang } from "@/context/lang-context";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";
import { uploadHireProofAction } from "@/lib/referral/confirmations";
import { idleAction } from "@/lib/auth/action-result";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function SubmitButton({ pendingLabel, label }: { pendingLabel: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function UploadWizard({ referralId, bucketName }: { referralId: string; bucketName: string }) {
  const { t } = useLang();
  const [state, formAction] = useActionState(uploadHireProofAction, idleAction);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (state.status === "ok") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)] p-6 text-center">
        <p className="flex items-center justify-center gap-2 text-lg font-semibold text-[var(--color-success)]">
          <Check className="size-6 shrink-0" strokeWidth={2.5} aria-hidden />
          {t("hire_upload_ok_title")}
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t("hire_upload_ok_body")}</p>
      </div>
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    setUploadedPath(null);
    const f = e.target.files?.[0];
    if (!f) return;

    if (!ALLOWED_MIME.includes(f.type as typeof ALLOWED_MIME[number])) {
      setUploadError(t("hire_upload_err_mime"));
      return;
    }
    if (f.size > MAX_BYTES) {
      setUploadError(t("hire_upload_err_size"));
      return;
    }
    setFile(f);

    // Datei direkt via Supabase Storage-API in den Bucket hochladen
    setUploading(true);
    try {
      const path = `hire-proofs/${referralId}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      // Signed Upload via API-Route um Service-Role-Key nicht im Browser zu exponieren
      const signedRes = await fetch("/api/storage/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: bucketName, path }),
      });
      if (!signedRes.ok) throw new Error(t("hire_upload_err_sign"));
      const { signedUrl } = (await signedRes.json()) as { signedUrl: string };

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": f.type },
        body: f,
      });
      if (!uploadRes.ok) throw new Error(t("hire_upload_err_upload"));
      setUploadedPath(path);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t("hire_upload_err_upload"));
      setFile(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      {uploadError && <FormAlert>{uploadError}</FormAlert>}

      {/* Hidden fields */}
      <input type="hidden" name="referralId" value={referralId} />
      {uploadedPath && <input type="hidden" name="storagePath" value={uploadedPath} />}
      {file && <input type="hidden" name="mimeType" value={file.type} />}
      {file && <input type="hidden" name="fileSize" value={String(file.size)} />}

      {/* Drop-Zone */}
      <div
        onClick={() => inputRef.current?.click()}
        className={[
          "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3",
          "rounded-[var(--radius-md)] border-2 border-dashed transition-colors",
          uploadedPath
            ? "border-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_6%,transparent)]"
            : "border-[var(--color-surface-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-brand-400)]",
        ].join(" ")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        aria-label={t("hire_upload_drop_aria")}
      >
        {uploading ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t("hire_upload_uploading")}</p>
        ) : uploadedPath && file ? (
          <>
            <p className="text-sm font-medium text-[var(--color-success)]">{file.name}</p>
            <p className="text-xs text-[var(--color-text-faint)]">
              {t("hire_upload_replace_hint").replace("{size}", (file.size / 1024).toFixed(0))}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("hire_upload_cta")}
            </p>
            <p className="text-xs text-[var(--color-text-faint)]">{t("hire_upload_formats")}</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={handleFileChange}
        aria-hidden
      />

      <div className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-4 text-xs text-[var(--color-text-faint)]">
        {t("hire_upload_privacy")}
      </div>

      <div className="flex justify-end border-t border-[var(--color-surface-border)] pt-6">
        <SubmitButton pendingLabel={t("hire_upload_submit_pending")} label={t("hire_upload_submit")} />
      </div>
    </form>
  );
}
