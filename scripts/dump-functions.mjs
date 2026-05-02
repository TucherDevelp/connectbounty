/**
 * Gibt alle Security-Definer- und Trigger-Funktionen mit ihrer aktuellen
 * Definition aus der Live-DB aus, damit wir sie qualifizieren können.
 */
import pg from "pg";
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows } = await c.query(`
  select
    p.proname                                            as name,
    pg_get_function_identity_arguments(p.oid)           as args,
    pg_get_functiondef(p.oid)                           as def,
    p.prosecdef                                         as secdef,
    array_to_string(p.proconfig, ', ')                  as config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.prosecdef = true or p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype)
  order by p.proname
`);

for (const r of rows) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`-- ${r.name}(${r.args})  secdef=${r.secdef}  config=${r.config}`);
  console.log(r.def);
}
await c.end();
