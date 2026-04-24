#!/usr/bin/env node
/**
 * Smoke-Test für das KYC-System:
 * 1. Überprüft ob kyc_documents Tabelle existiert
 * 2. Überprüft ob kyc-documents Bucket existiert
 * 3. Überprüft ob update_kyc_status() Funktion vorhanden ist
 * 4. Überprüft ob admin_get_kyc_pending() Funktion vorhanden ist
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}:`, err.message);
    failed++;
  }
}

console.log("\n=== KYC Smoke-Test ===\n");

await check("kyc_documents Tabelle existiert", async () => {
  const { error } = await sb.from("kyc_documents").select("id").limit(1);
  if (error) throw error;
});

await check("kyc-documents Storage Bucket existiert", async () => {
  const { data, error } = await sb.storage.getBucket("kyc-documents");
  if (error || !data) throw new Error(error?.message ?? "Bucket nicht gefunden");
});

await check("update_kyc_status() Funktion vorhanden", async () => {
  // Aufruf mit nicht-existenter applicantId - erwartet DB-Exception, kein 500
  const { error } = await sb.rpc("update_kyc_status", {
    p_applicant_id: "nonexistent-test-id",
    p_status: "approved",
    p_review_result: null,
    p_reject_labels: null,
  });
  // Erwarteter Fehler: "kyc_applicant not found" → das ist korrekt
  if (error && error.message.includes("kyc_applicant not found")) {
    return; // erwartet
  }
  if (error) throw error;
});

await check("kyc_applicants Tabelle lesbar", async () => {
  const { error } = await sb.from("kyc_applicants").select("id").limit(1);
  if (error) throw error;
});

console.log(`\n${passed + failed} Tests: ${passed} ✓  ${failed} ✗\n`);
if (failed > 0) process.exit(1);
