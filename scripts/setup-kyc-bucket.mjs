#!/usr/bin/env node
/**
 * Legt den Supabase Storage Bucket "kyc-documents" an (privat, max 10 MB).
 * Nutzt SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL aus .env.local.
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey);

console.log("▶ Supabase Storage Bucket 'kyc-documents' anlegen …");

const { data: existing } = await sb.storage.getBucket("kyc-documents");
if (existing) {
  console.log("✓ Bucket existiert bereits.");
} else {
  const { error } = await sb.storage.createBucket("kyc-documents", {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,   // 10 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error) {
    console.error("✗ Fehler beim Erstellen:", error.message);
    process.exit(1);
  }
  console.log("✓ Bucket 'kyc-documents' erstellt (privat, max 10 MB).");
}

console.log("✓ Fertig.");
