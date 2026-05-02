"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Upload } from "lucide-react";
import { useLang } from "@/context/lang-context";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-error";
import { rejectWithDocumentAction } from "@/lib/referral/confirmations";
import { idleAction } from "@/lib/auth/action-result";

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const REASON_MIN = 50;
const REASON_MAX = 2000;

function PendingButton({ pendingLabel, label }: { pendingLabel: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Inserent lehnt nach Kontaktfreigabe ab und MUSS dazu ein offizielles
 * Ablehnungsschreiben hochladen (Konzept-Pflicht).
 *
 * Ablauf:
 *   1. Datei via signed-upload in den Bucket 'rejection-documents' laden
 *   2. Begründung ≥ 50 Zeichen eingeben
 *   3. Server-Action `rejectWithDocumentAction` aufrufen → Status=rejected
 */
export function RejectWithDocumentButton({ referralId }: { referralId: string }) {
  const { t } = useLang();
  const [state, formAction] = useActionState(rejectWithDocumentAction, idleAction);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (state.status === "ok") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-error)]">
        <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        {state.message}
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        {t("ref_reject_doc_open")}
      </Button>
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    setUploadedPath(null);
    const f = e.target.files?.[0];
    if (!f) return;

    if (!ALLOWED_MIME.includes(f.type as typeof ALLOWED_MIME[number])) {
      setUploadError(t("ref_reject_doc_err_mime"));
      return;
    }
    if (f.size > MAX_BYTES) {
      setUploadError(t("ref_reject_doc_err_size"));
      return;
    }
    setFile(f);

    setUploading(true);
    try {
      // Pfad-Konvention {referral_id}/{filename} - wird serverseitig geprüft.
      const safeName = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${referralId}/${Date.now()}_${safeName}`;

      const signedRes = await fetch("/api/storage/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: "rejection-documents", path }),
      });
      if (!signedRes.ok) throw new Error(t("ref_reject_doc_err_sign"));
      const { signedUrl } = (await signedRes.json()) as { signedUrl: string };

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": f.type },
        body: f,
      });
      if (!uploadRes.ok) throw new Error(t("ref_reject_doc_err_upload"));
      setUploadedPath(path);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t("ref_reject_doc_err_upload"));
      setFile(null);
    } finally {
      setUploading(false);
    }
  }

  const canSubmit =
    Boolean(uploadedPath && file) &&
    reason.length >= REASON_MIN &&
    !uploading;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[color-mix(in_oklab,var(--color-error)_6%,transparent)] p-4"
    >
      {state.status === "error" && <FormAlert>{state.message}</FormAlert>}
      {uploadError && <FormAlert>{uploadError}</FormAlert>}

      <input type="hidden" name="referralId" value={referralId} />
      {uploadedPath && <input type="hidden" name="storagePath" value={uploadedPath} />}
      {file && <input type="hidden" name="mimeType" value={file.type} />}
      {file && <input type="hidden" name="fileSize" value={String(file.size)} />}
      {file && <input type="hidden" name="originalName" value={file.name} />}

      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {t("ref_reject_doc_title")}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t("ref_reject_doc_explainer")}
        </p>
      </div>

      {/* Datei-Auswahl */}
      <div
        onClick={() => inputRef.current?.click()}
        className={[
          "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed transition-colors p-3",
          uploadedPath
            ? "border-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_6%,transparent)]"
            : "border-[var(--color-surface-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-error)]",
        ].join(" ")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        aria-label={t("ref_reject_doc_drop_aria")}
      >
        {uploading ? (
          <p className="text-xs text-[var(--color-text-muted)]">{t("ref_reject_doc_uploading")}</p>
        ) : uploadedPath && file ? (
          <>
            <p className="text-xs font-medium text-[var(--color-success)]">{file.name}</p>
            <p className="text-[11px] text-[var(--color-text-faint)]">
              {(file.size / 1024).toFixed(0)} KB · {t("ref_reject_doc_replace_hint")}
            </p>
          </>
        ) : (
          <>
            <Upload className="size-4 shrink-0 text-[var(--color-text-muted)]" strokeWidth={2} aria-hidden />
            <p className="text-xs font-medium text-[var(--color-text-primary)]">
              {t("ref_reject_doc_cta")}
            </p>
            <p className="text-[11px] text-[var(--color-text-faint)]">
              {t("ref_reject_doc_formats")}
            </p>
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

      {/* Begründung */}
      <label className="text-xs font-medium text-[var(--color-text-primary)]">
        {t("ref_reject_doc_reason_label")}
      </label>
      <textarea
        name="reason"
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("ref_reject_doc_reason_ph")}
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-error)]"
        minLength={REASON_MIN}
        maxLength={REASON_MAX}
      />
      <p className="text-[11px] text-[var(--color-text-faint)]">
        {t("ref_reject_doc_reason_counter")
          .replace("{n}", String(reason.length))
          .replace("{min}", String(REASON_MIN))
          .replace("{max}", String(REASON_MAX))}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs underline text-[var(--color-text-muted)]"
        >
          {t("ref_cancel")}
        </button>
        {canSubmit ? (
          <PendingButton
            pendingLabel={t("ref_reject_doc_submit_pending")}
            label={t("ref_reject_doc_submit")}
          />
        ) : (
          <Button type="submit" variant="destructive" size="sm" disabled>
            {t("ref_reject_doc_submit")}
          </Button>
        )}
      </div>
    </form>
  );
}
