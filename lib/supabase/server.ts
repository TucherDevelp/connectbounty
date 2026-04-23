import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv, serverEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Supabase-Client für Server Components, Server Actions und Route Handler.
 *
 * Schreibt/liest Auth-Cookies via next/headers. Wichtig:
 *   - In Server Components ist cookies() read-only; das set/remove kann
 *     dort scheitern (Next.js wirft Errors). Die Helper schlucken diesen
 *     Spezialfall absichtlich, weil der Refresh in proxy.ts (siehe
 *     ./middleware.ts) ohnehin die kanonische Stelle für Cookie-Updates
 *     ist – Server Components sollen nur lesen.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = clientEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options as CookieOptions);
            }
          } catch {
            /* siehe Header-Kommentar – in RSC erwartet, irrelevant */
          }
        },
      },
    },
  );
}

/**
 * Service-Role-Client – umgeht ALLE RLS-Regeln.
 *
 * Nur für klar abgegrenzte Server-Operationen verwenden:
 *   - Webhooks (Sumsub, Stripe), die noch keinen User-Context haben.
 *   - Admin-Backoffice-Aktionen mit explizitem log_admin_action-Audit.
 *   - System-Cron-Jobs (Edge Functions).
 *
 * NIEMALS in normalen User-Flows (Login, Profile, Marketplace) verwenden –
 * dort immer getSupabaseServerClient() nutzen, damit RLS greift.
 */
export function getSupabaseServiceRoleClient() {
  const cEnv = clientEnv();
  const sEnv = serverEnv();

  return createServerClient<Database>(cEnv.NEXT_PUBLIC_SUPABASE_URL, sEnv.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll: () => [],
      setAll: () => {
        /* Service-Role-Client braucht keine Auth-Cookies */
      },
    },
  });
}
