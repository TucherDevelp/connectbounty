"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Supabase-Client für Client Components.
 *
 * Singleton pro Tab – createBrowserClient verwaltet intern den localStorage-
 * basierten Auth-State, daher reicht es, einmal pro Modul zu instanziieren.
 *
 * Niemals in Server Components / Route Handlern / Server Actions verwenden –
 * dort sind die Helper aus ./server.ts zu nutzen, weil sie Cookies via
 * next/headers korrekt schreiben können.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const env = clientEnv();
  browserClient = createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}
