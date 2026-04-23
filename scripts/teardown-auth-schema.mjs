#!/usr/bin/env node
/**
 * Führt scripts/sql/teardown-0001-init-auth.sql aus (DATABASE_URL in .env.local).
 * Danach: npm run db:migrate && npm run db:verify
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_PATH = path.join(__dirname, "sql", "teardown-0001-init-auth.sql");

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL fehlt in .env.local");
  process.exit(1);
}

const sql = readFileSync(SQL_PATH, "utf8");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(sql);
  console.log("✓ Teardown 0001 abgeschlossen.");
} finally {
  await client.end();
}
