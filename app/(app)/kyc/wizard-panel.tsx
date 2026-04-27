"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/context/lang-context";
import { DocumentWizard } from "@/components/kyc/document-wizard";

interface KycWizardPanelProps {
  applicantRowId: string;
}

/**
 * Entscheidet ob der Dokument-Wizard angezeigt wird.
 * Nach Abschluss wird die Seite neu geladen.
 */
export function KycWizardPanel({ applicantRowId }: KycWizardPanelProps) {
  const { t } = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleComplete = () => {
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-brand-400)]/40 p-4">
        <p className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">
          {t("kyc_wizard_panel_title")}
        </p>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">{t("kyc_wizard_panel_body")}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-400)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-300)]"
        >
          {t("kyc_wizard_panel_cta")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4">
      <DocumentWizard applicantRowId={applicantRowId} onComplete={handleComplete} />
    </div>
  );
}
