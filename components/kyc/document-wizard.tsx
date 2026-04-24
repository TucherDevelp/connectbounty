"use client";

import type { ReactNode } from "react";
import { useState, useRef, useCallback } from "react";
import { BookOpen, Camera, Check, CreditCard, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DocCategory = "id_card" | "passport";
type Step =
  | "doc-type"
  | "id_card_front"
  | "id_card_back"
  | "passport"
  | "selfie"
  | "review"
  | "done";

interface Capture {
  file: File;
  preview: string;
}

interface DocumentWizardProps {
  /** DB-UUID des kyc_applicants Eintrags (nicht die externe applicantId) */
  applicantRowId: string;
  /** Nach erfolgreichem Upload aller Dokumente + Einreichen */
  onComplete: () => void;
}

export function DocumentWizard({ applicantRowId, onComplete }: DocumentWizardProps) {
  const [step, setStep] = useState<Step>("doc-type");
  const [docType, setDocType] = useState<DocCategory>("id_card");
  const [captures, setCaptures] = useState<Partial<Record<string, Capture>>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentDocField, setCurrentDocField] = useState<string>("");

  const steps: Step[] =
    docType === "id_card"
      ? ["doc-type", "id_card_front", "id_card_back", "selfie", "review"]
      : ["doc-type", "passport", "selfie", "review"];

  const stepIndex = steps.indexOf(step);
  const progress = step === "done" ? 100 : Math.round((stepIndex / (steps.length - 1)) * 100);

  const captureStep = useCallback(
    (field: string, file: File) => {
      const preview = URL.createObjectURL(file);
      setCaptures((prev) => ({ ...prev, [field]: { file, preview } }));
    },
    [],
  );

  const openFilePicker = (field: string) => {
    setCurrentDocField(field);
    setError(null);
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Nur JPEG, PNG oder WebP erlaubt.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Datei zu groß (max 10 MB).");
      return;
    }
    captureStep(currentDocField, file);
    e.target.value = "";
  };

  const uploadDoc = async (field: string): Promise<boolean> => {
    const cap = captures[field];
    if (!cap) return false;

    const form = new FormData();
    form.append("applicantId", applicantRowId);
    form.append("documentType", field);
    form.append("file", cap.file);

    const res = await fetch("/api/kyc/documents", { method: "POST", body: form });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Upload fehlgeschlagen.");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setUploading(true);
    setError(null);

    const fields =
      docType === "id_card"
        ? ["id_card_front", "id_card_back", "selfie"]
        : ["passport", "selfie"];

    for (const field of fields) {
      const ok = await uploadDoc(field);
      if (!ok) {
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    setStep("done");
    onComplete();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
          <Check className="size-9" strokeWidth={2.5} aria-hidden />
        </div>
        <p className="text-lg font-semibold text-[var(--color-text-primary)]">
          Dokumente eingereicht
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Dein Antrag wird jetzt geprüft. Du erhältst eine Benachrichtigung sobald das Ergebnis
          vorliegt.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFileChange}
      />

      {/* Progress bar */}
      {step !== "doc-type" && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>Schritt {stepIndex} von {steps.length - 1}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--color-brand-400)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {/* Steps */}
      {step === "doc-type" && (
        <DocTypeStep
          selected={docType}
          onSelect={setDocType}
          onNext={() => setStep(docType === "id_card" ? "id_card_front" : "passport")}
        />
      )}

      {(step === "id_card_front" || step === "id_card_back" || step === "passport") && (
        <CaptureStep
          field={step}
          label={
            step === "id_card_front"
              ? "Personalausweis - Vorderseite"
              : step === "id_card_back"
              ? "Personalausweis - Rückseite"
              : "Reisepass - Datenseite"
          }
          hint={
            step === "id_card_front"
              ? "Fotografiere oder lade die Vorderseite deines Personalausweises hoch."
              : step === "id_card_back"
              ? "Fotografiere oder lade die Rückseite deines Personalausweises hoch."
              : "Fotografiere oder lade die Seite mit deinen persönlichen Daten hoch."
          }
          capture={captures[step]}
          onCapture={() => openFilePicker(step)}
          onBack={() =>
            setStep(
              step === "id_card_front"
                ? "doc-type"
                : step === "id_card_back"
                ? "id_card_front"
                : "doc-type",
            )
          }
          onNext={() =>
            setStep(
              step === "id_card_front"
                ? "id_card_back"
                : step === "id_card_back"
                ? "selfie"
                : "selfie",
            )
          }
        />
      )}

      {step === "selfie" && (
        <CaptureStep
          field="selfie"
          label="Selfie"
          hint="Halte dein Gesicht gut erkennbar in die Kamera. Stelle sicher, dass du gut beleuchtet bist."
          capture={captures["selfie"]}
          onCapture={() => openFilePicker("selfie")}
          onBack={() => setStep(docType === "id_card" ? "id_card_back" : "passport")}
          onNext={() => setStep("review")}
          isSelfie
        />
      )}

      {step === "review" && (
        <ReviewStep
          docType={docType}
          captures={captures}
          onBack={() => setStep("selfie")}
          onRetake={(field) => {
            openFilePicker(field);
          }}
          onSubmit={handleSubmit}
          uploading={uploading}
        />
      )}
    </div>
  );
}

// ── Sub-Komponenten ────────────────────────────────────────────────────────

function DocTypeStep({
  selected,
  onSelect,
  onNext,
}: {
  selected: DocCategory;
  onSelect: (t: DocCategory) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-sm font-medium text-[var(--color-text-primary)]">
          Welches Dokument möchtest du verwenden?
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Wähle ein gültiges amtliches Ausweisdokument.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DocTypeCard
          icon={<CreditCard className="size-8 text-[var(--color-brand-400)]" strokeWidth={1.75} aria-hidden />}
          title="Personalausweis"
          description="Vorder- und Rückseite"
          selected={selected === "id_card"}
          onClick={() => onSelect("id_card")}
        />
        <DocTypeCard
          icon={<BookOpen className="size-8 text-[var(--color-brand-400)]" strokeWidth={1.75} aria-hidden />}
          title="Reisepass"
          description="Nur Datenseite"
          selected={selected === "passport"}
          onClick={() => onSelect("passport")}
        />
      </div>
      <Button onClick={onNext} size="lg" className="self-start">
        Weiter
      </Button>
    </div>
  );
}

function DocTypeCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-[var(--radius-lg)] border p-4 text-left transition-colors",
        selected
          ? "border-[var(--color-brand-400)] bg-[var(--color-brand-400)]/5"
          : "border-[var(--color-surface-border)] hover:border-[var(--color-brand-400)]/50",
      )}
    >
      <span className="flex shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
      </div>
      {selected && (
        <Check className="ml-auto size-5 shrink-0 text-[var(--color-brand-400)]" strokeWidth={2.5} aria-hidden />
      )}
    </button>
  );
}

function CaptureStep({
  field,
  label,
  hint,
  capture,
  onCapture,
  onBack,
  onNext,
  isSelfie = false,
}: {
  field: string;
  label: string;
  hint: string;
  capture: Capture | undefined;
  onCapture: () => void;
  onBack: () => void;
  onNext: () => void;
  isSelfie?: boolean;
}) {
  void field;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
        <p className="text-sm text-[var(--color-text-muted)]">{hint}</p>
      </div>

      {/* Upload-Zone */}
      <button
        type="button"
        onClick={onCapture}
        className={cn(
          "relative flex min-h-48 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border-2 border-dashed transition-colors",
          capture
            ? "border-[var(--color-brand-400)]/50"
            : "border-[var(--color-surface-border)] hover:border-[var(--color-brand-400)]/50",
        )}
      >
        {capture ? (
          // Blob-URL-Vorschau, bewusst <img>
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={capture.preview}
            alt="Vorschau"
            className={cn("absolute inset-0 size-full object-cover", isSelfie && "object-top")}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            {isSelfie ? (
              <Camera className="size-12 text-[var(--color-text-muted)]" strokeWidth={1.5} aria-hidden />
            ) : (
              <FileImage className="size-12 text-[var(--color-text-muted)]" strokeWidth={1.5} aria-hidden />
            )}
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Klicken zum Hochladen
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">JPEG · PNG · WebP · max 10 MB</p>
          </div>
        )}
      </button>

      {capture && (
        <button
          type="button"
          onClick={onCapture}
          className="self-start text-xs text-[var(--color-brand-400)] underline hover:text-[var(--color-brand-300)]"
        >
          Erneut hochladen
        </button>
      )}

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onBack} size="sm">
          Zurück
        </Button>
        <Button onClick={onNext} size="sm" disabled={!capture}>
          Weiter
        </Button>
      </div>
    </div>
  );
}

function ReviewStep({
  docType,
  captures,
  onBack,
  onRetake,
  onSubmit,
  uploading,
}: {
  docType: DocCategory;
  captures: Partial<Record<string, Capture>>;
  onBack: () => void;
  onRetake: (field: string) => void;
  onSubmit: () => void;
  uploading: boolean;
}) {
  const fields: { field: string; label: string }[] =
    docType === "id_card"
      ? [
          { field: "id_card_front", label: "Personalausweis Vorderseite" },
          { field: "id_card_back", label: "Personalausweis Rückseite" },
          { field: "selfie", label: "Selfie" },
        ]
      : [
          { field: "passport", label: "Reisepass" },
          { field: "selfie", label: "Selfie" },
        ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">
          Überprüfen & Einreichen
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Überprüfe deine Dokumente. Alle Angaben müssen gut lesbar sein.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(({ field, label }) => {
          const cap = captures[field];
          return (
            <div key={field} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
              <div className="relative h-32 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface-2)]">
                {cap && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cap.preview} alt={label} className="absolute inset-0 size-full object-cover" />
                )}
              </div>
              <button
                type="button"
                onClick={() => onRetake(field)}
                className="self-start text-xs text-[var(--color-brand-400)] underline hover:text-[var(--color-brand-300)]"
              >
                Neu aufnehmen
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={onBack} size="sm" disabled={uploading}>
          Zurück
        </Button>
        <Button onClick={onSubmit} size="sm" disabled={uploading}>
          {uploading ? "Wird hochgeladen …" : "Antrag einreichen"}
        </Button>
      </div>
    </div>
  );
}
