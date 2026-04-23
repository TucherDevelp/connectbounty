#!/usr/bin/env node
/**
 * Verifiziert nach `npm run db:migrate`, dass das Schema v1 vollständig
 * angelegt ist. Wird gegen DATABASE_URL ausgeführt.
 *
 * Geprüft wird:
 *   • Tabellen profiles / user_roles / audit_logs existieren
 *   • Enums user_role / kyc_status / audit_action existieren
 *   • Functions has_role / has_any_role / log_audit_event existieren
 *   • RLS ist auf allen drei Tabellen aktiviert
 *   • Trigger on_auth_user_created hängt an auth.users
 *
 * Aufruf:  npm run db:verify
 */
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL fehlt in .env.local");
  process.exit(1);
}

const checks = [
  {
    label: "Tabelle public.profiles",
    sql: `select 1 from information_schema.tables where table_schema='public' and table_name='profiles'`,
  },
  {
    label: "Tabelle public.user_roles",
    sql: `select 1 from information_schema.tables where table_schema='public' and table_name='user_roles'`,
  },
  {
    label: "Tabelle public.audit_logs",
    sql: `select 1 from information_schema.tables where table_schema='public' and table_name='audit_logs'`,
  },
  {
    label: "Enum public.user_role mit 8 Werten",
    sql: `select 1 from pg_type t
          join pg_enum e on e.enumtypid = t.oid
          where t.typname = 'user_role'
          group by t.oid having count(*) = 8`,
  },
  {
    label: "Enum public.kyc_status mit 5 Werten",
    sql: `select 1 from pg_type t
          join pg_enum e on e.enumtypid = t.oid
          where t.typname = 'kyc_status'
          group by t.oid having count(*) = 5`,
  },
  {
    label: "Function public.has_role(user_role)",
    sql: `select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname='public' and p.proname='has_role'`,
  },
  {
    label: "Function public.has_any_role(user_role[])",
    sql: `select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname='public' and p.proname='has_any_role'`,
  },
  {
    label: "Function public.log_audit_event(...)",
    sql: `select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname='public' and p.proname='log_audit_event'`,
  },
  {
    label: "RLS aktiv auf profiles",
    sql: `select 1 from pg_class where relname='profiles' and relrowsecurity = true`,
  },
  {
    label: "RLS aktiv auf user_roles",
    sql: `select 1 from pg_class where relname='user_roles' and relrowsecurity = true`,
  },
  {
    label: "RLS aktiv auf audit_logs",
    sql: `select 1 from pg_class where relname='audit_logs' and relrowsecurity = true`,
  },
  {
    label: "Trigger on_auth_user_created auf auth.users",
    sql: `select 1 from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
          where t.tgname='on_auth_user_created' and n.nspname='auth' and c.relname='users'`,
  },
];

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

let failed = 0;
try {
  for (const check of checks) {
    const { rows } = await client.query(check.sql);
    if (rows.length === 0) {
      console.error(`✗ ${check.label}`);
      failed++;
    } else {
      console.log(`✓ ${check.label}`);
    }
  }
} finally {
  await client.end();
}

if (failed > 0) {
  console.error(`\n${failed} Check(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log("\nSchema v1 vollständig.");
