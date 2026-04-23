#!/usr/bin/env node
/**
 * Simuliert den Browser-Login-Flow gegen den laufenden Dev-Server.
 * 1. GET /login → Server-Action-ID aus dem HTML extrahieren
 * 2. POST /login mit FormData als Next.js Server-Action (x-action-id)
 * 3. Folgenden Redirect + Session-Cookie prüfen
 * 4. GET / mit Cookie → sollte 200 (Dashboard) liefern, kein Redirect auf /login
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.argv[2] ?? "alice@demo.connectbounty.local";
const PASSWORD = process.argv[3] ?? "DemoPass-1234!";

function getCookiesFromResponse(res) {
  const raw = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie")].filter(Boolean);
  return raw
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function mergeCookies(a, b) {
  const map = new Map();
  for (const c of [a, b].filter(Boolean).join("; ").split("; ").filter(Boolean)) {
    const [k, ...rest] = c.split("=");
    map.set(k, rest.join("="));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

console.log(`▶  Login-Flow gegen ${BASE}  (${EMAIL})`);

// 1) GET /login → Action-ID extrahieren
const r1 = await fetch(`${BASE}/login`, { redirect: "manual" });
console.log(`   1) GET /login  → ${r1.status}`);
if (r1.status !== 200) {
  console.error("   ✗ Unerwarteter Status. Headers:", [...r1.headers.entries()].slice(0, 6));
  process.exit(1);
}
const html = await r1.text();
let cookies = getCookiesFromResponse(r1);

// Server-Actions sind in Next.js im HTML als data-action="..." ODER im <form action="...">
// bzw. über den React-Client wird beim Submit ein POST an /login mit Header
// `next-action` gesendet. Wir extrahieren die ID aus dem HTML.
const idMatch =
  html.match(/"\$ACTION_ID_([a-f0-9]+)"/) ||
  html.match(/data-action="([a-f0-9]{40})"/) ||
  html.match(/next-action="([a-f0-9]{40})"/) ||
  html.match(/\$\$ACTION_1:\s*"([a-f0-9]{40})"/);

const actionId = idMatch ? idMatch[1] : null;
if (!actionId) {
  // Kein Action-ID gefunden – wir nehmen einen robusteren Ansatz:
  // Next 16 embedded die ID in Script-Chunks. Sicherer ist ein direkter
  // Aufruf an die Supabase-API, nachdem wir /login im Browser-Stil geladen haben.
  console.log("   · Kein Action-ID-Muster im HTML gefunden – prüfe Form-Attribute:");
  const formMatch = html.match(/<form[^>]*action="([^"]+)"[^>]*>/);
  console.log("     form action:", formMatch?.[1] ?? "(keins)");
  console.log("   · Fallback: prüfe nur, ob /login rendert und Form vorhanden ist.");
  const hasEmail = /name="email"/.test(html);
  const hasPassword = /name="password"/.test(html);
  console.log(`     email-input: ${hasEmail}  password-input: ${hasPassword}`);
}

console.log(`   · Action-ID: ${actionId ?? "(unbekannt – Server-Action-Call übersprungen)"}`);

// 2) Direkter Fetch gegen Supabase (das ist, was die Server-Action intern macht)
//    um zu isolieren, ob das Problem im Next.js-Layer oder im Supabase-Layer liegt.
console.log("\n   2) Direkter Supabase signInWithPassword …");
const { createClient } = await import("@supabase/supabase-js");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(URL_SB, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sbRes = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (sbRes.error) {
  console.log(`      ✗ Supabase-Login: ${sbRes.error.message}`);
  process.exit(2);
}
console.log(`      ✓ Supabase-Login ok: uid=${sbRes.data.user.id.slice(0, 8)}`);

// 3) Tatsächliche Server-Action triggern
if (actionId) {
  const fd = new FormData();
  fd.set("email", EMAIL);
  fd.set("password", PASSWORD);

  const r2 = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: {
      "next-action": actionId,
      cookie: cookies,
    },
    body: fd,
    redirect: "manual",
  });
  console.log(`\n   3) POST /login (Server-Action)  → ${r2.status}`);
  cookies = mergeCookies(cookies, getCookiesFromResponse(r2));
  const body = await r2.text();

  const redirectLoc = r2.headers.get("x-action-redirect") || r2.headers.get("location");
  console.log(`      · x-action-redirect: ${r2.headers.get("x-action-redirect") ?? "(none)"}`);
  console.log(`      · location:          ${r2.headers.get("location") ?? "(none)"}`);
  console.log(`      · hat sb-Cookie:     ${/sb-.*-auth-token/.test(cookies)}`);
  if (!redirectLoc && !/sb-.*-auth-token/.test(cookies)) {
    console.log("      ⚠  Server-Action hat weder Redirect noch Session-Cookie gesetzt.");
    console.log("      Body-Anfang (erste 300 Zeichen):");
    console.log(body.slice(0, 300));
  }

  // 4) Dashboard probieren
  const r3 = await fetch(`${BASE}/`, { headers: { cookie: cookies }, redirect: "manual" });
  console.log(`\n   4) GET /  mit Session-Cookie  → ${r3.status}  (location=${r3.headers.get("location") ?? "-"})`);
  if (r3.status === 200) console.log("      ✓ Dashboard erreichbar");
  else console.log("      ✗ Kein Dashboard – Auth greift nicht durch");
}
