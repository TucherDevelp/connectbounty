#!/usr/bin/env node
/**
 * Minimaler Migrations-Runner - fährt alle SQL-Files aus
 * supabase/migrations/ in lexikografischer Reihenfolge gegen die DB,
 * deren Connection-String in DATABASE_URL steht (.env.local).
 *
 * Eigene Migrations-Tracking-Tabelle public._migrations:
 *   filename text primary key, applied_at timestamptz, checksum text
 *
 * Verhalten:
 *   • Bereits angewandte Migrationen mit unverändertem Checksum: skip.
 *   • Bereits angewandte Migrationen mit geändertem Checksum: ABORT
 *     (Migrationen sind unveränderlich; neue SQL-Files anlegen).
 *   • Neue Migrationen: in einer Transaktion ausführen.
 *
 * Aufruf:  npm run db:migrate
 *
 * Anti-Foot-Gun: dieser Runner führt KEIN Auto-Rollback bei NodeJS-Crash.
 * Für komplexere Workflows kommt ab Phase 2 die Supabase-CLI dazu
 * (`supabase db push`), die mit Shadow-DBs und Diff arbeitet.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL fehlt in .env.local");
  console.error("  Pooler-String aus Supabase → Settings → Database → URI (Session-Mode).");
  process.exit(1);
}

function checksum(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
      return { filename, sql, checksum: checksum(sql) };
    });
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public._migrations (
      filename   text primary key,
      checksum   text not null,
      applied_at timestamptz not null default now()
    );
  `);
}

async function getApplied(client) {
  const { rows } = await client.query(
    "select filename, checksum from public._migrations order by filename asc",
  );
  return new Map(rows.map((r) => [r.filename, r.checksum]));
}

async function applyOne(client, migration) {
  console.log(`→ ${migration.filename} (${migration.checksum}) anwenden …`);
  await client.query("begin");
  try {
    await client.query(migration.sql);
    await client.query(
      "insert into public._migrations (filename, checksum) values ($1, $2)",
      [migration.filename, migration.checksum],
    );
    await client.query("commit");
    console.log(`✓ ${migration.filename}`);
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const migrations = listMigrations();

    let ranAny = false;
    for (const m of migrations) {
      const known = applied.get(m.filename);
      if (known === m.checksum) {
        console.log(`· ${m.filename} bereits angewandt`);
        continue;
      }
      if (known && known !== m.checksum) {
        throw new Error(
          `Migration ${m.filename} wurde bereits angewandt, aber Checksum hat sich geändert ` +
            `(${known} → ${m.checksum}). Migrationen sind unveränderlich - lege eine neue an.`,
        );
      }
      await applyOne(client, m);
      ranAny = true;
    }

    if (!ranAny) console.log("Nichts zu tun.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("✗ Migration fehlgeschlagen:", err.message);
  process.exit(1);
});
