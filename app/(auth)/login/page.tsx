import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Melde dich bei ConnectBounty an.",
};

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Willkommen zurück</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.
        </p>
      </header>

      <LoginForm />
    </div>
  );
}
