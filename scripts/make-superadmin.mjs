#!/usr/bin/env node
/**
 * Vergibt die Rolle 'superadmin' an einen bestehenden User.
 *
 * Aufruf:
 *   node --env-file=.env.local scripts/make-superadmin.mjs <email>
 *
 * Beispiel:
 *   node --env-file=.env.local scripts/make-superadmin.mjs oliver@example.com
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Verwendung: node scripts/make-superadmin.mjs <email>");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1. User-ID suchen
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) { console.error("✗ listUsers:", listErr.message); process.exit(1); }

const user = list.users.find((u) => u.email === email);
if (!user) {
  console.error(`✗ Kein User mit E-Mail '${email}' gefunden.`);
  console.log("Vorhandene Adressen:");
  for (const u of list.users.slice(0, 10)) console.log(" •", u.email);
  process.exit(1);
}

console.log(`   Gefunden: ${user.email}  (id=${user.id})`);

// 2. Rolle vergeben (upsert - falls schon vorhanden, keine doppelten Einträge)
const { error: roleErr } = await admin.from("user_roles").upsert(
  { user_id: user.id, role: "superadmin" },
  { onConflict: "user_id,role" },
);
if (roleErr) { console.error("✗ Rolle vergeben:", roleErr.message); process.exit(1); }

// 3. KYC auf approved setzen (sonst können manche Aktionen blockieren)
const { error: kycErr } = await admin
  .from("profiles")
  .update({ kyc_status: "approved" })
  .eq("id", user.id);
if (kycErr) console.warn("⚠  KYC-Update fehlgeschlagen:", kycErr.message);

console.log(`\n✓ ${email} ist jetzt superadmin (KYC=approved).`);
console.log(`  Admin-Panel: http://localhost:3000/admin`);
