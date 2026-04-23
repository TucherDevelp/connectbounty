#!/usr/bin/env node
/**
 * Diagnose: existieren die Demo-User und funktionieren ihre Credentials?
 * Kein Seed, nur Read-Checks + ein signInWithPassword pro User.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("✗ ENV fehlt (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY)");
  process.exit(1);
}

const PASSWORD = "DemoPass-1234!";
const EMAILS = [
  "alice@demo.connectbounty.local",
  "bob@demo.connectbounty.local",
  "carol@demo.connectbounty.local",
];

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("▶  Supabase-URL:", URL);
console.log();

console.log("1) Existieren User in auth?");
let page = 1;
const perPage = 200;
const all = [];
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) throw error;
  all.push(...data.users);
  if (data.users.length < perPage) break;
  page++;
}
for (const email of EMAILS) {
  const u = all.find((x) => x.email === email);
  if (u) {
    console.log(
      `   ✓ ${email.padEnd(42)}  id=${u.id.slice(0, 8)}  confirmed=${Boolean(u.email_confirmed_at)}`,
    );
  } else {
    console.log(`   ✗ ${email}  NICHT GEFUNDEN`);
  }
}
console.log();

console.log("2) signInWithPassword pro User:");
for (const email of EMAILS) {
  const c = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) {
    console.log(`   ✗ ${email}  → ${error.status ?? ""} ${error.code ?? ""}  ${error.message}`);
  } else {
    console.log(`   ✓ ${email}  → session ok (uid=${data.user.id.slice(0, 8)})`);
  }
}
console.log();

console.log("3) profiles.kyc_status:");
const { data: profiles, error: profErr } = await admin
  .from("profiles")
  .select("id, kyc_status, display_name")
  .in(
    "id",
    all.filter((u) => EMAILS.includes(u.email ?? "")).map((u) => u.id),
  );
if (profErr) console.log("   ✗ profiles-Abfrage:", profErr.message);
else for (const p of profiles ?? []) console.log(`   · ${p.display_name?.padEnd(25)}  kyc=${p.kyc_status}`);
