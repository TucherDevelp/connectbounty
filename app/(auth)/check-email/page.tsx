import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "E-Mail bestätigen – ConnectBounty" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fast geschafft!</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Wir haben dir einen Bestätigungslink geschickt. Bitte öffne deine E-Mail
          und klicke auf den Link, um dein Konto zu aktivieren.
        </p>
        <p className="text-xs text-[var(--color-text-faint)]">
          Kein E-Mail erhalten?{" "}
          <Link
            href="/register"
            className="text-[var(--color-brand-400)] hover:underline"
          >
            Erneut registrieren
          </Link>
          {" "}oder prüfe deinen Spam-Ordner.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--color-brand-400)] hover:underline"
        >
          Zurück zum Login
        </Link>
      </CardContent>
    </Card>
  );
}
