#!/usr/bin/env node
/**
 * Seed-Skript für lokales UI-Testing von Phase 3.3.
 *
 * Was wird angelegt (alle Mails enden auf @demo.connectbounty.local,
 * damit echte User nicht kollidieren):
 *   • alice@demo.connectbounty.local  (KYC approved, Owner von 3 Bounties)
 *   • bob@demo.connectbounty.local    (KYC approved, Empfehler)
 *   • carol@demo.connectbounty.local  (KYC unverified – für Gate-Tests)
 *
 * Passwort für alle: DemoPass-1234!
 *
 * Das Skript ist idempotent: beim erneuten Aufruf werden bestehende
 * Demo-User (inkl. deren Bounties/Referrals via ON DELETE CASCADE) erst
 * komplett gelöscht und neu erzeugt. Keine Produktionsnutzung – wir
 * schreiben direkt mit SERVICE_ROLE.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "DemoPass-1234!";
const DEMO_USERS = [
  { email: "alice@demo.connectbounty.local", name: "Alice Demo", kyc: "approved" },
  { email: "bob@demo.connectbounty.local", name: "Bob Demo", kyc: "approved" },
  { email: "carol@demo.connectbounty.local", name: "Carol (ohne KYC)", kyc: "unverified" },
];

function oneYearFromNow() {
  return new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
}

async function deleteExistingDemoUsers() {
  // admin.listUsers liefert alle Auth-User; wir filtern anhand der Mail.
  let page = 1;
  const perPage = 200;
  const targets = [];
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      if (u.email && u.email.endsWith("@demo.connectbounty.local")) targets.push(u.id);
    }
    if (data.users.length < perPage) break;
    page++;
  }
  for (const id of targets) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  if (targets.length > 0) {
    console.log(`  · ${targets.length} alte Demo-User entfernt`);
  }
}

async function createUser({ email, name, kyc }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  const id = data.user.id;
  if (kyc !== "unverified") {
    const { error: upErr } = await admin
      .from("profiles")
      .update({ kyc_status: kyc })
      .eq("id", id);
    if (upErr) throw new Error(`profile update ${email}: ${upErr.message}`);
  }
  return { id, email };
}

async function createBounty(ownerId, patch) {
  const { data, error } = await admin
    .from("bounties")
    .insert({
      owner_id: ownerId,
      title: patch.title,
      description: patch.description,
      bonus_amount: patch.bonus_amount,
      bonus_currency: patch.bonus_currency ?? "EUR",
      location: patch.location ?? null,
      industry: patch.industry ?? null,
      tags: patch.tags ?? [],
      expires_at: patch.expires_at ?? oneYearFromNow(),
      status: patch.status ?? "draft",
      published_at: patch.status === "open" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insert bounty '${patch.title}': ${error.message}`);
  return data.id;
}

async function main() {
  console.log("▶  Seeding Demo-Daten …\n");
  await deleteExistingDemoUsers();

  const users = {};
  for (const u of DEMO_USERS) {
    users[u.email.split("@")[0]] = await createUser(u);
    console.log(`  · ${u.email}  (${u.kyc})`);
  }

  // Alice owns mehrere Bounties mit unterschiedlichen Filter-Achsen.
  const b1 = await createBounty(users.alice.id, {
    title: "Senior React Engineer (Remote)",
    description:
      "Wir suchen eine:n erfahrene:n React-Engineer mit mindestens 4 Jahren Erfahrung. " +
      "Fokus auf Performance, Barrierefreiheit und Component-Design. Remote-first aus DE/AT/CH.",
    bonus_amount: 1500,
    location: "Remote",
    industry: "Software",
    tags: ["react", "typescript", "frontend"],
    status: "open",
  });

  const b2 = await createBounty(users.alice.id, {
    title: "Mobile Lead Flutter (Hybrid München)",
    description:
      "Mobile Lead für ein wachsendes Fintech-Team. Verantwortung für App-Architektur, " +
      "Code-Review-Kultur und Hiring. Hybrid-Setup in München, 2 Tage/Woche vor Ort.",
    bonus_amount: 3000,
    location: "München",
    industry: "Mobile",
    tags: ["flutter", "mobile", "lead"],
    status: "open",
  });

  const b3 = await createBounty(users.alice.id, {
    title: "Data Engineer Snowflake / dbt",
    description:
      "Data Engineer mit tiefem Wissen in Snowflake, dbt und Airflow. " +
      "Aufbau des zentralen Data-Warehouses, enge Zusammenarbeit mit Analytics und ML.",
    bonus_amount: 2200,
    location: "Berlin",
    industry: "Data",
    tags: ["snowflake", "dbt", "python"],
    status: "open",
  });

  const b4Draft = await createBounty(users.alice.id, {
    title: "Entwurf: Principal Security Engineer",
    description:
      "Entwurf-Bounty – wird im Browser-Test veröffentlicht/gelöscht, um den " +
      "Draft-Flow end-to-end anzusehen.",
    bonus_amount: 5000,
    location: "Wien",
    industry: "Security",
    tags: ["security", "iam"],
    status: "draft",
  });

  // Bob gibt eine Empfehlung auf Bounty 1 ab.
  const { error: refErr } = await admin.from("bounty_referrals").insert({
    bounty_id: b1,
    referrer_id: users.bob.id,
    candidate_name: "Ada Lovelace",
    candidate_email: "ada@example.com",
    candidate_contact: "linkedin.com/in/ada",
    message:
      "Ich kenne Ada aus einem früheren Projekt – starke React-Ingenieurin, " +
      "pragmatisch, sehr gute Kommunikation.",
    status: "submitted",
  });
  if (refErr) throw new Error(`insert referral: ${refErr.message}`);

  console.log("\nFertig. Zusammenfassung:");
  console.log(`  3 offene Bounties (${b1.slice(0, 8)}, ${b2.slice(0, 8)}, ${b3.slice(0, 8)})`);
  console.log(`  1 Draft-Bounty   (${b4Draft.slice(0, 8)})`);
  console.log(`  1 Empfehlung     (Bob → Ada auf Bounty 1)`);
  console.log("\nLogins (Passwort: " + PASSWORD + "):");
  for (const u of DEMO_USERS) {
    console.log(`  • ${u.email.padEnd(44)} ${u.kyc}`);
  }
  console.log("\nSurfe lokal:");
  console.log("  http://localhost:3000/login");
  console.log("  http://localhost:3000/bounties");
  console.log("  http://localhost:3000/bounties/" + b1);
}

main().catch((e) => {
  console.error("\n✗ Seed fehlgeschlagen:", e.message);
  process.exit(1);
});
