import type { Metadata } from "next";
import { RequestResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen",
  description: "Fordere einen Link zum Zurücksetzen deines Passworts an.",
};

export default function ResetPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Passwort zurücksetzen
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Trag deine E-Mail-Adresse ein – falls sie bei uns existiert, schicken wir dir
          einen Link zum Zurücksetzen.
        </p>
      </header>

      <RequestResetForm />
    </div>
  );
}
