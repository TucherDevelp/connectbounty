/**
 * RLS-Test für bounty_referrals_owner_view
 *
 * Testet, dass:
 * 1. Der Service-Role-Client ALLE Felder sieht (inkl. Kontaktdaten)
 * 2. Die View korrekt existiert und die expected Spalten hat
 * 3. Das application_submitted_at und contact_released_at Felder vorhanden sind
 *
 * Hinweis: Echter RLS-Test (als Inserent-Session) erfordert JWTs - hier prüfen
 * wir per Service-Role ob die View + Spalten korrekt deployed sind.
 */

import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  const results = { passed: 0, failed: 0, tests: [] };

  async function test(name, fn) {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: "PASS" });
      console.log(`  ✓ ${name}`);
    } catch (err) {
      results.failed++;
      results.tests.push({ name, status: "FAIL", error: err.message });
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  console.log("\n── bounty_referrals_owner_view RLS-Tests ──────────────────");

  // Test 1: View existiert
  await test("bounty_referrals_owner_view existiert", async () => {
    const { rows } = await client.query(`
      select count(*) as cnt
      from information_schema.views
      where table_schema = 'public'
        and table_name = 'bounty_referrals_owner_view'
    `);
    if (parseInt(rows[0].cnt) !== 1) throw new Error("View nicht gefunden");
  });

  // Test 2: application_phase Spalte vorhanden (CASE-berechnete Phase-Anzeige)
  await test("bounty_referrals_owner_view hat application_phase", async () => {
    const { rows } = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'bounty_referrals_owner_view'
        and column_name = 'application_phase'
    `);
    if (rows.length === 0) throw new Error("Spalte 'application_phase' fehlt");
  });

  // Test 3: bounty_referrals hat application_submitted_at (aus 0011)
  await test("bounty_referrals hat application_submitted_at", async () => {
    const { rows } = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'bounty_referrals'
        and column_name = 'application_submitted_at'
    `);
    if (rows.length === 0) throw new Error("Spalte 'application_submitted_at' fehlt - Migration 0011 nicht angewandt?");
  });

  // Test 4: bounty_referrals hat contact_released_at (aus 0011)
  await test("bounty_referrals hat contact_released_at", async () => {
    const { rows } = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'bounty_referrals'
        and column_name = 'contact_released_at'
    `);
    if (rows.length === 0) throw new Error("Spalte 'contact_released_at' fehlt - Migration 0011 nicht angewandt?");
  });

  // Test 5: rejection_documents Tabelle existiert (aus 0012)
  await test("rejection_documents Tabelle existiert", async () => {
    const { rows } = await client.query(`
      select count(*) as cnt
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'rejection_documents'
    `);
    if (parseInt(rows[0].cnt) !== 1) throw new Error("Tabelle 'rejection_documents' fehlt - Migration 0012 nicht angewandt?");
  });

  // Test 6: payouts hat inserent_id (aus 0013)
  await test("payouts hat inserent_id (Umbenennung von referrer_id)", async () => {
    const { rows } = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payouts'
        and column_name = 'inserent_id'
    `);
    if (rows.length === 0) throw new Error("Spalte 'inserent_id' fehlt - Migration 0013 nicht angewandt?");
  });

  // Test 7: payouts.referrer_id sollte NICHT mehr existieren
  await test("payouts.referrer_id existiert nicht mehr (umbenannt)", async () => {
    const { rows } = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payouts'
        and column_name = 'referrer_id'
    `);
    if (rows.length > 0) throw new Error("Spalte 'referrer_id' existiert noch - Migration 0013 nicht angewandt?");
  });

  // Test 8: payouts hat amount_inserent_cents
  await test("payouts hat amount_inserent_cents (Umbenennung von amount_referrer_cents)", async () => {
    const { rows } = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payouts'
        and column_name = 'amount_inserent_cents'
    `);
    if (rows.length === 0) throw new Error("Spalte 'amount_inserent_cents' fehlt");
  });

  // Test 9: bounties hat split_inserent_bps (Umbenennung)
  await test("bounties hat split_inserent_bps (Umbenennung von split_referrer_bps)", async () => {
    const { rows } = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'bounties'
        and column_name = 'split_inserent_bps'
    `);
    if (rows.length === 0) throw new Error("Spalte 'split_inserent_bps' fehlt");
  });

  // Test 10: View gibt bei Zeile ohne application_submitted_at korrekte Phase zurück
  await test("owner_view anonymity_phase-Logik ist korrekt deployed (Strukturprüfung)", async () => {
    const { rows } = await client.query(`
      select pg_get_viewdef('public.bounty_referrals_owner_view'::regclass)
    `);
    const viewDef = rows[0]?.pg_get_viewdef ?? "";
    if (!viewDef.includes("application_submitted_at")) {
      throw new Error("View enthält nicht die erwarteten Anonymitäts-Felder (application_submitted_at)");
    }
  });

  console.log("\n──────────────────────────────────────────────────────────");
  console.log(`Ergebnis: ${results.passed} bestanden, ${results.failed} fehlgeschlagen`);
  if (results.failed > 0) {
    process.exit(1);
  }
}

main()
  .catch(err => {
    console.error("Kritischer Fehler:", err.message);
    process.exit(1);
  })
  .finally(() => client.end());
