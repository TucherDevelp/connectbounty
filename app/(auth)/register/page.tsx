import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Konto erstellen",
  description: "Erstelle ein ConnectBounty-Konto.",
};

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Konto erstellen</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Lege in unter 60 Sekunden los. KYC und Auszahlungen kommen später dazu.
        </p>
      </header>

      <RegisterForm />
    </div>
  );
}
