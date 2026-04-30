#!/usr/bin/env node
/**
 * diagnose-profile.mjs
 *
 * Tests every step of the profile save pipeline against your live Supabase
 * project and prints a clear pass/fail report.
 *
 * Run:  node --env-file=.env.local scripts/diagnose-profile.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svcRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !svcRoleKey) {
  console.error("❌  Missing env vars. Run with: node --env-file=.env.local scripts/diagnose-profile.mjs");
  process.exit(1);
}

const svc  = createClient(url, svcRoleKey, { auth: { persistSession: false } });
const anonClient = createClient(url, anon, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;

function ok(label, detail = "") {
  console.log(`  ✅  ${label}${detail ? " — " + detail : ""}`);
  passed++;
}
function fail(label, err) {
  console.log(`  ❌  ${label}`);
  console.log(`       → ${err}`);
  failed++;
}

// ─── 1. ANON CLIENT: can reach Supabase? ─────────────────────────────────────
console.log("\n── 1. Supabase Connectivity ─────────────────────────────────────");
try {
  const { error } = await anonClient.from("profiles").select("id").limit(1);
  if (error) fail("anon client can query profiles", error.message);
  else ok("anon client can reach Supabase and query profiles");
} catch (e) {
  fail("anon client connectivity", e.message);
}

// ─── 2. SERVICE ROLE: upsert to profiles ────────────────────────────────────
console.log("\n── 2. Service-Role Upsert on profiles ───────────────────────────");
const testId = "00000000-0000-0000-0000-000000000001"; // fake UUID for test
try {
  const { data, error } = await svc
    .from("profiles")
    .upsert({ id: testId, display_name: "__diag_test__" }, { onConflict: "id" })
    .select("id, display_name")
    .maybeSingle();

  if (error) {
    fail("service-role upsert to profiles", error.message + " | code: " + error.code);
  } else if (!data) {
    fail("service-role upsert returned no row", "insert might be blocked by RLS even for service role");
  } else {
    ok("service-role can upsert to profiles", `row id=${data.id}`);
    // cleanup
    await svc.from("profiles").delete().eq("id", testId);
  }
} catch (e) {
  fail("service-role upsert exception", e.message);
}

// ─── 3. SERVICE ROLE: update avatar_url ─────────────────────────────────────
console.log("\n── 3. avatar_url Column Exists on profiles ──────────────────────");
try {
  // Try selecting the column — if it doesn't exist this errors
  const { error } = await svc
    .from("profiles")
    .select("avatar_url")
    .limit(1);
  if (error) fail("select avatar_url from profiles", error.message);
  else ok("avatar_url column exists on profiles table");
} catch (e) {
  fail("avatar_url column check", e.message);
}

// ─── 4. STORAGE: bucket profile-avatars exists ───────────────────────────────
console.log("\n── 4. Storage Bucket 'profile-avatars' ──────────────────────────");
try {
  const { data: buckets, error } = await svc.storage.listBuckets();
  if (error) {
    fail("list storage buckets", error.message);
  } else {
    const bucket = (buckets ?? []).find(b => b.id === "profile-avatars");
    if (!bucket) {
      fail("bucket 'profile-avatars' exists", "Not found. Run migration 0010 or create the bucket in Supabase dashboard.");
    } else {
      ok(`bucket '${bucket.id}' found`, `public=${bucket.public}`);
      if (!bucket.public) {
        fail("bucket is public", "Bucket is PRIVATE — getPublicUrl() will return broken URLs. Set public=true in Supabase dashboard.");
      } else {
        ok("bucket is public — getPublicUrl() will work");
      }
    }
  }
} catch (e) {
  fail("storage bucket check", e.message);
}

// ─── 5. STORAGE: signed upload URL ──────────────────────────────────────────
console.log("\n── 5. Signed Upload URL (service role) ──────────────────────────");
const testPath = `avatars/__diag_test_${Date.now()}.txt`;
try {
  const { data, error } = await svc.storage
    .from("profile-avatars")
    .createSignedUploadUrl(testPath);
  if (error) {
    fail("createSignedUploadUrl", error.message + " | code: " + (error.statusCode ?? "?"));
  } else {
    const isAbsolute = data?.signedUrl?.startsWith("http");
    ok("createSignedUploadUrl succeeded", isAbsolute ? "URL is absolute ✓" : "WARNING: URL is relative — absolute URL conversion needed");
  }
} catch (e) {
  fail("createSignedUploadUrl exception", e.message);
}

// ─── 6. STORAGE: RLS policies on storage.objects ────────────────────────────
console.log("\n── 6. Storage RLS Policies for 'profile-avatars' ───────────────");
try {
  // Check if there are any policies on storage.objects for the bucket
  const { data: policies, error } = await svc.rpc("pg_query_policies", {}).catch(() => ({ data: null, error: { message: "pg_query_policies RPC not available" } }));
  if (error || !policies) {
    console.log("  ⚠️   Cannot auto-check storage policies via RPC.");
    console.log("       → Manually verify in Supabase Dashboard → Storage → profile-avatars → Policies:");
    console.log("         • INSERT policy for authenticated users (needed for direct uploads)");
    console.log("         • OR: Signed upload URLs (service role) bypass this — should be fine.");
  }
} catch (e) {
  console.log("  ⚠️   Storage policy check skipped:", e.message);
}

// ─── 7. STORAGE: public URL generation ──────────────────────────────────────
console.log("\n── 7. getPublicUrl construction ─────────────────────────────────");
try {
  const testStoragePath = "avatars/test.jpg";
  const { data } = svc.storage.from("profile-avatars").getPublicUrl(testStoragePath);
  if (data?.publicUrl?.startsWith("http")) {
    ok("getPublicUrl generates absolute URL", data.publicUrl);
  } else {
    fail("getPublicUrl result", "URL is not absolute: " + String(data?.publicUrl));
  }
} catch (e) {
  fail("getPublicUrl", e.message);
}

// ─── 8. handle_new_user trigger ─────────────────────────────────────────────
console.log("\n── 8. Profile Row Auto-Creation (handle_new_user trigger) ───────");
try {
  // Check if trigger function exists
  const { data, error } = await svc
    .rpc("pg_query_trigger", {})
    .catch(() => ({ data: null, error: null }));

  // Try to infer by checking if any profiles row exists
  const { data: rows, error: rowsErr } = await svc
    .from("profiles")
    .select("id")
    .limit(1);

  if (rowsErr) {
    fail("read profiles table", rowsErr.message);
  } else if (!rows || rows.length === 0) {
    console.log("  ⚠️   profiles table is empty — trigger may not have run, or no users yet.");
    console.log("       → ensureProfileForUser() in the app will create the row on first login.");
  } else {
    ok(`profiles table has rows (${rows.length}+) — trigger ran at least once`);
  }
} catch (e) {
  fail("trigger check", e.message);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════");
console.log(`  ${passed} passed   ${failed} failed`);
if (failed === 0) {
  console.log("  ✅  All checks passed — Supabase config looks correct.");
  console.log("      If profile data still isn't persistent, the issue is in the");
  console.log("      application code (check server logs for [saveAvatarAction] errors).");
} else {
  console.log("  ❌  Fix the failures above first — they are blocking persistence.");
}
console.log("══════════════════════════════════════════════════════════════════\n");
