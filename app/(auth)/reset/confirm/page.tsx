import type { Metadata } from "next";
import { ConfirmResetForm } from "./confirm-form";

export const metadata: Metadata = {
  title: "Neues Passwort setzen",
};

export default function ConfirmResetPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Neues Passwort</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Vergib hier dein neues Passwort. Du wirst danach automatisch eingeloggt.
        </p>
      </header>

      <ConfirmResetForm />
    </div>
  );
}
