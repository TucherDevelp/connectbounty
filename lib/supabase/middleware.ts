import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";
import type { Database } from "./types";

export type SessionRefreshResult = {
  response: NextResponse;
  isAuthenticated: boolean;
};

/**
 * Refresht die Supabase-Session bei jedem Request und liefert das Ergebnis
 * inklusive eines Booleans, ob aktuell eine gültige Session existiert.
 *
 * Wird aus proxy.ts aufgerufen. Der Caller entscheidet anhand des Pfads
 * über Redirects (Route-Guards) und hängt anschließend die Security-Header
 * auf die Response.
 *
 * Wichtig (laut @supabase/ssr Doku): zwischen createServerClient() und
 * supabase.auth.getUser() darf NICHTS Schreibendes passieren.
 */
export async function updateSupabaseSession(
  request: NextRequest,
): Promise<SessionRefreshResult> {
  let response = NextResponse.next({ request });
  const env = clientEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getUser();
  return { response, isAuthenticated: Boolean(data.user) && !error };
}
