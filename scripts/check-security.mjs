import pg from "pg";
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// Storage policies for profile-avatars
const { rows: storagePolicies } = await c.query(`
  select policyname, cmd, substring(qual,1,120) as qual
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
`);
console.log("=== storage.objects policies ===");
storagePolicies.forEach(r => console.log(" ", r.policyname, "|", r.cmd));

// Check table columns + row count for no-policy tables
for (const t of ["chat_messages", "conversations", "payout_requests", "referral_events"]) {
  const { rows: cols } = await c.query(
    `select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position limit 6`,
    [t]
  );
  const { rows: cnt } = await c.query(`select count(*) from public.${t}`);
  console.log(`\n=== ${t} (${cnt[0].count} rows) ===`);
  cols.forEach(col => console.log(" ", col.column_name, col.data_type));
}

// EXECUTE privileges on our functions
const { rows: grants } = await c.query(`
  select p.proname, r.rolname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_shdepend d on d.objid = p.oid
  join pg_roles r on r.oid = d.refobjid
  where n.nspname = 'public'
    and p.prosecdef = true
    and d.deptype = 'a'
  order by p.proname, r.rolname
`);
console.log("\n=== SECURITY DEFINER grants (who can execute) ===");
grants.forEach(g => console.log(" ", g.proname, "→", g.rolname));

await c.end();
