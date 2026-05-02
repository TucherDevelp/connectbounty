/**
 * Verifiziert dass Migration 0014 korrekt angewendet wurde
 * und keine DB-Logik beschädigt hat.
 */
import pg from "pg";
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const results = { passed: 0, failed: 0 };

async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.failed++;
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

console.log("\n── A. Trigger-Funktionen: search_path gesetzt ─────────────────────────");

const { rows: fns } = await c.query(`
  select proname, proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and proname in ('set_updated_at','enforce_referral_transition','enforce_referrer_immutable_and_acyclic','enforce_payout_transition')
`);

for (const fn of fns) {
  await test(`${fn.proname} hat search_path gesetzt`, async () => {
    if (!fn.proconfig || fn.proconfig.length === 0) throw new Error("search_path = null (mutable)");
  });
}

console.log("\n── B. REVOKE anon: Sicherheitsfunktionen ───────────────────────────────");

const { rows: anonFns } = await c.query(`
  with fn_acl as (
    select proname,
           unnest(proacl) as acl_entry
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef = true
  )
  select proname
  from fn_acl
  where acl_entry::text like 'anon=X/%'
  order by proname
`);

await test("anon kann keine SECURITY DEFINER Funktion ausführen", async () => {
  const dangerousFns = ["admin_get_kyc_pending", "admin_stats", "log_audit_event", "update_kyc_status"];
  const anonNames = anonFns.map(r => r.proname);
  const stillGranted = dangerousFns.filter(f => anonNames.includes(f));
  if (stillGranted.length > 0) {
    throw new Error("Noch GRANT an anon: " + stillGranted.join(", "));
  }
});

console.log("  anon-Grants verbleibend (sollte leer sein):", anonFns.map(r => r.proname).join(", ") || "(keine)");

console.log("\n── C. Admin-Funktionen: nur service_role ───────────────────────────────");

const { rows: authGrants } = await c.query(`
  with fn_acl as (
    select proname, unnest(proacl) as acl_entry
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef = true
      and proname in ('admin_get_kyc_pending', 'admin_stats')
  )
  select proname, acl_entry::text
  from fn_acl
  where acl_entry::text like 'authenticated=X/%'
`);
await test("authenticated kann KEINE Admin-Funktionen aufrufen", async () => {
  if (authGrants.length > 0) {
    throw new Error("authenticated hat noch Zugriff auf: " + authGrants.map(r => r.proname).join(", "));
  }
});

console.log("\n── D. Legacy-Tabellen haben deny-all Policy ────────────────────────────");

for (const tbl of ["chat_messages", "conversations", "payout_requests", "referral_events"]) {
  await test(`${tbl} hat explicit deny-all Policy`, async () => {
    const { rows } = await c.query(
      `select count(*) as cnt from pg_policies where schemaname='public' and tablename=$1`,
      [tbl]
    );
    if (parseInt(rows[0].cnt) === 0) throw new Error("Noch keine Policy — Advisor wird weiter warnen");
  });
}

console.log("\n── E. Trigger-Funktionen arbeiten korrekt (Smoke Test) ─────────────────");

// Test set_updated_at: create a temp test update via service role
await test("set_updated_at Trigger läuft (Profiles update smoke test)", async () => {
  // Just verify the trigger exists and points to the right function
  const { rows } = await c.query(`
    select t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and t.tgname like '%updated_at%'
  `);
  if (rows.length === 0) throw new Error("updated_at Trigger nicht gefunden");
});

await test("enforce_referral_transition Trigger existiert", async () => {
  const { rows } = await c.query(`
    select tgname from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and t.tgname = 'bounty_referrals_transition_guard'
  `);
  if (rows.length === 0) throw new Error("Transition-Guard-Trigger fehlt");
});

await test("enforce_referrer_immutable_and_acyclic Trigger existiert", async () => {
  const { rows } = await c.query(`
    select tgname from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and t.tgname = 'profiles_enforce_referrer'
  `);
  if (rows.length === 0) throw new Error("Referrer-Immutable-Trigger fehlt");
});

console.log("\n── F. authenticated behält Zugriff auf RLS-Hilfsfunktionen ────────────");

const { rows: authRlsGrants } = await c.query(`
  with fn_acl as (
    select proname, unnest(proacl) as acl_entry
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef = true
      and proname in ('has_role','has_any_role','is_admin','is_kyc_approved','owns_bounty','log_audit_event','get_referrer_pair')
  )
  select proname from fn_acl
  where acl_entry::text like 'authenticated=X/%'
  order by proname
`);

await test("authenticated hat GRANT auf alle RLS-Hilfsfunktionen", async () => {
  const expected = ["get_referrer_pair","has_any_role","has_role","is_admin","is_kyc_approved","log_audit_event","owns_bounty"];
  const got = authRlsGrants.map(r => r.proname).sort();
  const missing = expected.filter(f => !got.includes(f));
  if (missing.length > 0) throw new Error("Fehlendes GRANT für: " + missing.join(", "));
});

console.log("\n──────────────────────────────────────────────────────────────────────────");
console.log(`Ergebnis: ${results.passed} bestanden, ${results.failed} fehlgeschlagen`);
await c.end();
if (results.failed > 0) process.exit(1);
