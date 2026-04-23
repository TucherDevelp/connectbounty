import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Refresht die Supabase-Session bei jedem Request, damit serverseitig
 * kein abgelaufenes Access-Token mehr verwendet wird.
 *
 * Wird aus proxy.ts aufgerufen. Returnt eine NextResponse mit aktualisierten
 * Set-Cookie-Headern; der Caller hängt darauf seine Security-Header.
 *
 * Wichtig (laut @supabase/ssr Doku): Niemals zwischen createServerClient()
 * und dem return getUser() Aufruf irgendetwas Schreibendes tun – sonst
 * inkonsistente Session-States.
 */
export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
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

  // Triggert den Refresh; Ergebnis bewusst ignoriert – Auth-Guards
  // entscheiden später anhand getUser() in den jeweiligen Routen.
  await supabase.auth.getUser();

  return response;
}
