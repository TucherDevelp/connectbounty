import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth- und E-Mail-Confirmation-Callback.
 *
 * Supabase leitet nach Klick auf einen Magic-Link / Confirm-Link hierher
 * weiter. Wir tauschen den Code via exchangeCodeForSession() gegen eine
 * gültige Session und leiten danach weiter.
 *
 * Querystring:
 *   code  – Auth-Code von Supabase
 *   next  – optionaler Redirect-Pfad nach Erfolg (sicher gegen Open-Redirect:
 *           nur lokale, mit "/" beginnende Pfade werden akzeptiert).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
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

  return NextResponse.redirect(new URL(next, url.origin));
}
