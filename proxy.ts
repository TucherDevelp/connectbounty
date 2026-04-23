import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Globaler Proxy (früher "middleware" – seit Next.js 16 umbenannt zu "proxy",
 * siehe https://nextjs.org/docs/messages/middleware-to-proxy).
 *
 * Aufgaben in Phase 0.4:
 *   - Supabase-Session bei jedem Request auffrischen (@supabase/ssr).
 *   - Security-Header auf allen Antworten setzen.
 *
 * Erweiterungen in späteren Phasen:
 *   - Phase 1: Route-Guards für (app)/** und (admin)/** auf Basis von
 *     supabase.auth.getUser().
 *   - Phase 6: Admin-MFA-Check.
 *   - Phase 7: Upstash-Rate-Limits, CSP-Nonce statt 'unsafe-inline'.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = await updateSupabaseSession(request);
  applySecurityHeaders(response);
  return response;
}

function applySecurityHeaders(response: NextResponse): void {
  const headers = response.headers;

  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  );

  // CSP – defensiv; Sumsub/Stripe/Supabase werden in den jeweiligen Phasen
  // explizit allowlisted. 'unsafe-inline' für Styles ist mit Tailwind v4
  // derzeit nötig und wird in Phase 7 durch Nonces ersetzt.
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
