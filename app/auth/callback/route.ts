import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/auth/roles";

/**
 * OAuth- und E-Mail-Confirmation-Callback.
 *
 * Supabase leitet nach Klick auf einen Magic-Link / Confirm-Link / nach
 * erfolgreichem OAuth hierher weiter. Wir tauschen den Code via
 * exchangeCodeForSession() gegen eine gültige Session und leiten danach
 * weiter.
 *
 * Querystring:
 *   code      – Auth-Code von Supabase
 *   next      – optionaler Redirect-Pfad nach Erfolg (sicher gegen
 *               Open-Redirect: nur lokale, mit "/" beginnende Pfade werden
 *               akzeptiert).
 *   provider  – optionaler Hinweis, von welchem Provider der Callback kommt
 *               ("google" | "email"). Wird nur fürs Audit-Log genutzt.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const provider = url.searchParams.get("provider") ?? "email";
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback_failed", url.origin));
  }

  // Audit-Eintrag schreiben. Fehler hier dürfen den Login nicht blockieren.
  try {
    await logAuditEvent({
      action: "user.login",
      metadata: { provider, via: "callback" },
    });
  } catch {
    // bewusst geschluckt
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
