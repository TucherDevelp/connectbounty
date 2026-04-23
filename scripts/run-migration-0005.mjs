#!/usr/bin/env node
/**
 * Führt Migration 0005_approval_workflow.sql aus.
 * Nutzt DATABASE_URL aus .env.local (Session-Pooler-kompatibel via postgres.js).
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Manuell .env.local laden
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL fehlt in .env.local");
  process.exit(1);
}

const { Client } = require("pg");
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const migrationSql = readFileSync(
  resolve(__dirname, "../supabase/migrations/0005_approval_workflow.sql"),
  "utf8",
);

console.log("Führe Migration 0005_approval_workflow.sql aus...");

try {
  await client.connect();
  await client.query(migrationSql);
  console.log("✓ Migration erfolgreich angewendet.");
} catch (err) {
  console.error("✗ Fehler:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
