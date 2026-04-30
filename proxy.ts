import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

/**
 * Globaler Proxy (früher "middleware" - seit Next.js 16 umbenannt zu "proxy",
 * siehe https://nextjs.org/docs/messages/middleware-to-proxy).
 *
 * Aufgaben:
 *   1. Supabase-Session bei jedem Request refreshen (@supabase/ssr).
 *   2. Route-Guards:
 *        - Eingeloggte User auf Auth-Seiten (/login, /register, /reset)
 *          → Redirect auf /
 *        - Unauthentifizierte Aufrufe auf alle übrigen App-Routen
 *          → Redirect auf /login?redirect=<originalPfad>
 *   3. Security-Header auf allen Antworten setzen.
 *
 * Erweiterungen in späteren Phasen:
 *   - Phase 6: Admin-MFA-Check für /admin/**.
 *   - Phase 7: Upstash-Rate-Limits, CSP-Nonce statt 'unsafe-inline'.
 */

const AUTH_ROUTES = ["/", "/login", "/register", "/reset"];
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/reset",
  "/auth/callback",
  "/check-email",
  "/legal/terms",
  "/legal/privacy",
  "/legal/impressum",
];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicRoute(pathname: string): boolean {
  if (pathname.startsWith("/legal/")) return true;
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, isAuthenticated } = await updateSupabaseSession(request);
  const pathname = request.nextUrl.pathname;

  if (isAuthenticated && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    copyCookies(response, redirect);
    applySecurityHeaders(redirect);
    return redirect;
  }

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?redirect=${encodeURIComponent(pathname)}`;
    const redirect = NextResponse.redirect(url);
    copyCookies(response, redirect);
    applySecurityHeaders(redirect);
    return redirect;
  }

  applySecurityHeaders(response);
  return response;
}

function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
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

  // CSP - defensiv. 'unsafe-inline' für Styles/Scripts ist mit Tailwind v4
  // und Next-RSC derzeit nötig und wird in Phase 7 durch Nonces ersetzt.
  // Im Dev-Modus benötigt React zusätzlich 'unsafe-eval' für Error-Overlays.
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Supabase Storage public URLs (avatar images, hire-proofs thumbnails)
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
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
