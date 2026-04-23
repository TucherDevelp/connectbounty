#!/usr/bin/env node
/**
 * Manueller Smoketest: prüft, ob die Supabase-Credentials in .env.local
 * gegen die echte Cloud auflösen.
 *
 * Aufruf:  npm run check:supabase
 *
 * Erwartung: 2x "OK" – einmal Anon-Key, einmal Service-Role-Key.
 * Ein Fehler hier ist KEIN Test-Fehler, sondern bedeutet, dass die Werte
 * in .env.local falsch sind oder das Projekt nicht erreichbar ist.
 *
 * Env wird via `node --env-file=.env.local` aus package.json geladen.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("✗ .env.local unvollständig – siehe .env.example.");
  process.exit(1);
}

console.log(`→ Supabase URL: ${url}`);

async function check(label, key, opts = {}) {
  const client = createClient(url, key, opts);
  const { error } = await client.auth.getSession();
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${label}: OK`);
}

await check("Anon-Key", anon);
await check("Service-Role-Key", service, {
  auth: { autoRefreshToken: false, persistSession: false },
});
