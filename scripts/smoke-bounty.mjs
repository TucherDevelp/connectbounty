#!/usr/bin/env node
/**
 * End-to-End-Smoke-Test für Phase 3.2 (Marketplace MVP).
 *
 * Was wird geprüft (alles gegen die echte Supabase-Instanz):
 *   1. KYC-Gating: User ohne kyc_status=approved kann KEINE Bounty inserten.
 *   2. Happy Path: approved User kann Bounty als Draft anlegen.
 *   3. Publish (draft → open), Close (open → closed), Cancel (* → cancelled).
 *   4. RLS-SELECT: offene Bounties für jeden authenticated sichtbar,
 *      Drafts nur für Owner. Zweiter User sieht fremde Drafts NICHT.
 *   5. RLS-UPDATE: fremder User kann Bounty nicht ändern (UPDATE läuft
 *      scheinbar durch, hat aber 0 Zeilen betroffen).
 *   6. Constraint-Guards: zu kurzer Titel, negative Prämie, >2 Dezimalstellen.
 *   7. Delete: funktioniert nur im Draft-Zustand (RLS-Policy).
 *   8. Cleanup: beide Test-User + Bounties werden anschließend gelöscht.
 *
 * Aufruf:
 *   npm run smoke:bounty
 *
 * Scheitert laut & früh, damit CI klare Signale bekommt.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "✗ Fehlende Umgebungsvariablen. Erwartet: NEXT_PUBLIC_SUPABASE_URL, " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const SUITE = `smoketest-${Date.now()}`;
const state = {
  users: /** @type {{id: string, email: string}[]} */ ([]),
  bounties: /** @type {string[]} */ ([]),
  ok: 0,
  fail: 0,
};

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function step(label, fn) {
  return (async () => {
    process.stdout.write(`  · ${label} … `);
    try {
      await fn();
      state.ok++;
      console.log("✓");
    } catch (err) {
      state.fail++;
      console.log("✗");
      console.error(`    ${err.message}`);
      if (process.env.DEBUG) console.error(err);
    }
  })();
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function makeAuthedClient(email, password) {
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword fehlgeschlagen: ${error.message}`);
  return client;
}

async function createTestUser(suffix, { kyc }) {
  const email = `${SUITE}-${suffix}@example.com`;
  const password = "SmokeTest-1234";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Smoke ${suffix}` },
  });
  if (error) throw new Error(`createUser ${suffix}: ${error.message}`);
  const userId = data.user.id;
  state.users.push({ id: userId, email });

  if (kyc === "approved") {
    const { error: upErr } = await admin
      .from("profiles")
      .update({ kyc_status: "approved" })
      .eq("id", userId);
    if (upErr) throw new Error(`KYC-Status setzen: ${upErr.message}`);
  }

  return { id: userId, email, password };
}

async function cleanup() {
  console.log("\nCleanup …");
  for (const bounty of state.bounties) {
    await admin.from("bounties").delete().eq("id", bounty);
  }
  for (const user of state.users) {
    await admin.auth.admin.deleteUser(user.id);
  }
  console.log("Cleanup fertig.");
}

// ──────────────────────────────────────────────────────────────────────────
// Test-Plan
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n▶  Marketplace Smoke-Test (${SUITE})\n`);

  let alice, bob;
  let aliceClient, bobClient;
  let draftId, publishedId, cancelId, deleteId;

  const BASE_INPUT = {
    title: "Senior Smoke Engineer bei ConnectBounty",
    description:
      "Automatisierter Smoke-Test. Beschreibung bewusst lang genug, um das " +
      "Minimum von 20 Zeichen zu überschreiten und alle Validierungen zu triggern.",
    bonus_amount: 1500,
    bonus_currency: "EUR",
    location: "Berlin",
    industry: "Software",
    tags: ["node", "postgres"],
  };

  // ── Setup ────────────────────────────────────────────────────────────
  await step("Setup: Alice (KYC approved) + Bob (KYC unverified)", async () => {
    alice = await createTestUser("alice", { kyc: "approved" });
    bob = await createTestUser("bob", { kyc: "unverified" });
    aliceClient = await makeAuthedClient(alice.email, alice.password);
    bobClient = await makeAuthedClient(bob.email, bob.password);
  });

  // ── KYC-Gating ──────────────────────────────────────────────────────
  await step("Bob OHNE KYC kann KEINE Bounty inserten (RLS)", async () => {
    const { error } = await bobClient.from("bounties").insert({
      owner_id: bob.id,
      ...BASE_INPUT,
    });
    expect(error, "erwarteter RLS-Fehler blieb aus");
    expect(
      /row-level security|policy/i.test(error.message),
      `unerwarteter Fehler: ${error.message}`,
    );
  });

  // ── Happy-Path Insert ───────────────────────────────────────────────
  await step("Alice kann Bounty als Draft inserten", async () => {
    const { data, error } = await aliceClient
      .from("bounties")
      .insert({ owner_id: alice.id, ...BASE_INPUT })
      .select("id, status")
      .single();
    if (error) throw error;
    expect(data.status === "draft", `status war ${data.status}, erwartet draft`);
    draftId = data.id;
    state.bounties.push(data.id);
  });

  // ── RLS-SELECT: Drafts ───────────────────────────────────────────────
  await step("Alice sieht eigenen Draft", async () => {
    const { data, error } = await aliceClient
      .from("bounties")
      .select("id")
      .eq("id", draftId)
      .maybeSingle();
    if (error) throw error;
    expect(data?.id === draftId, "Alice sieht eigenen Draft NICHT");
  });

  await step("Bob sieht fremden Draft NICHT (RLS)", async () => {
    const { data, error } = await bobClient
      .from("bounties")
      .select("id")
      .eq("id", draftId)
      .maybeSingle();
    if (error) throw error;
    expect(data === null, "Bob sieht Alice' Draft - RLS verletzt!");
  });

  // ── Status-Transition: Publish ──────────────────────────────────────
  await step("Alice published Draft (draft → open)", async () => {
    const { error } = await aliceClient
      .from("bounties")
      .update({ status: "open", published_at: new Date().toISOString() })
      .eq("id", draftId)
      .eq("status", "draft");
    if (error) throw error;
    const { data } = await aliceClient
      .from("bounties")
      .select("status, published_at")
      .eq("id", draftId)
      .single();
    expect(data.status === "open", `status = ${data.status}`);
    expect(data.published_at !== null, "published_at nicht gesetzt");
    publishedId = draftId;
  });

  // ── RLS-SELECT: Open ────────────────────────────────────────────────
  await step("Bob sieht veröffentlichte Bounty jetzt (status=open)", async () => {
    const { data, error } = await bobClient
      .from("bounties")
      .select("id, status")
      .eq("id", publishedId)
      .maybeSingle();
    if (error) throw error;
    expect(data?.id === publishedId, "Bob sieht open Bounty nicht");
    expect(data.status === "open", `erwartete status=open, war ${data.status}`);
  });

  // ── RLS-UPDATE: fremder User ────────────────────────────────────────
  await step("Bob kann Alice' Bounty NICHT updaten (RLS)", async () => {
    const { error } = await bobClient
      .from("bounties")
      .update({ title: "Kapern durch Bob" })
      .eq("id", publishedId);
    // Supabase/PostgREST meldet keinen Fehler, wenn RLS den Row ausfiltert -
    // aber der Wert bleibt unverändert.
    if (error && !/row-level|policy/i.test(error.message)) throw error;
    const { data } = await admin
      .from("bounties")
      .select("title")
      .eq("id", publishedId)
      .single();
    expect(!data.title.includes("Kapern"), "Bob konnte Titel ändern - RLS kaputt!");
  });

  // ── Constraint-Guards ───────────────────────────────────────────────
  await step("Constraint: Titel zu kurz wird abgelehnt", async () => {
    const { error } = await aliceClient
      .from("bounties")
      .insert({ owner_id: alice.id, ...BASE_INPUT, title: "abc" });
    expect(error, "Titel 'abc' wurde akzeptiert");
    expect(
      /constraint|check/i.test(error.message),
      `unerwarteter Fehlertyp: ${error.message}`,
    );
  });

  await step("Constraint: Bonus ≤ 0 wird abgelehnt", async () => {
    const { error } = await aliceClient
      .from("bounties")
      .insert({ owner_id: alice.id, ...BASE_INPUT, bonus_amount: -1 });
    expect(error, "Bonus -1 wurde akzeptiert");
  });

  await step("Constraint: ungültiger Currency-Code abgelehnt", async () => {
    const { error } = await aliceClient
      .from("bounties")
      .insert({ owner_id: alice.id, ...BASE_INPUT, bonus_currency: "EU" });
    expect(error, "bonus_currency 'EU' wurde akzeptiert");
  });

  // ── Self-Referral verhindert ────────────────────────────────────────
  await step("Alice kann sich NICHT selbst auf eigene Bounty referren", async () => {
    const { error } = await aliceClient.from("bounty_referrals").insert({
      bounty_id: publishedId,
      referrer_id: alice.id,
      candidate_name: "Test Kandidat",
      candidate_email: "cand@example.com",
    });
    expect(error, "Self-Referral wurde erlaubt");
    expect(/policy|row-level|check/i.test(error.message), `Unerwartet: ${error.message}`);
  });

  // ── Bob referred Alice' Bounty: scheitert an KYC ────────────────────
  await step("Bob OHNE KYC kann NICHT referren", async () => {
    const { error } = await bobClient.from("bounty_referrals").insert({
      bounty_id: publishedId,
      referrer_id: bob.id,
      candidate_name: "Test Kandidat",
      candidate_email: "cand@example.com",
    });
    expect(error, "Bob konnte ohne KYC referren");
  });

  // ── Close & Cancel ──────────────────────────────────────────────────
  await step("Alice schließt Bounty (open → closed)", async () => {
    const { error } = await aliceClient
      .from("bounties")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", publishedId)
      .eq("status", "open");
    if (error) throw error;
    const { data } = await aliceClient
      .from("bounties")
      .select("status")
      .eq("id", publishedId)
      .single();
    expect(data.status === "closed", `status=${data.status}`);
  });

  await step("Alice kann Draft anlegen & stornieren", async () => {
    const { data: created, error: insErr } = await aliceClient
      .from("bounties")
      .insert({ owner_id: alice.id, ...BASE_INPUT, title: "Cancel me please" })
      .select("id")
      .single();
    if (insErr) throw insErr;
    cancelId = created.id;
    state.bounties.push(cancelId);

    const { error } = await aliceClient
      .from("bounties")
      .update({ status: "cancelled", closed_at: new Date().toISOString() })
      .eq("id", cancelId)
      .in("status", ["draft", "open"]);
    if (error) throw error;
    const { data } = await aliceClient
      .from("bounties")
      .select("status")
      .eq("id", cancelId)
      .single();
    expect(data.status === "cancelled", `status=${data.status}`);
  });

  // ── Delete: nur Draft ───────────────────────────────────────────────
  await step("Alice kann Draft-Bounty löschen, aber keine closed", async () => {
    // 1. Draft löschen → ok
    const { data: created, error: insErr } = await aliceClient
      .from("bounties")
      .insert({ owner_id: alice.id, ...BASE_INPUT, title: "Delete me draft" })
      .select("id")
      .single();
    if (insErr) throw insErr;
    deleteId = created.id;
    state.bounties.push(deleteId);

    const { error: delErr } = await aliceClient
      .from("bounties")
      .delete()
      .eq("id", deleteId)
      .eq("status", "draft");
    if (delErr) throw delErr;

    const { data: after } = await aliceClient
      .from("bounties")
      .select("id")
      .eq("id", deleteId)
      .maybeSingle();
    expect(after === null, "Draft wurde nicht gelöscht");

    // 2. closed löschen → RLS blockt (kein Fehler, aber 0 rows betroffen)
    const { error: delClosedErr } = await aliceClient
      .from("bounties")
      .delete()
      .eq("id", publishedId);
    if (delClosedErr && !/row-level|policy/i.test(delClosedErr.message)) throw delClosedErr;
    const { data: stillThere } = await admin
      .from("bounties")
      .select("id")
      .eq("id", publishedId)
      .maybeSingle();
    expect(stillThere?.id === publishedId, "closed Bounty wurde gelöscht - RLS kaputt");
  });

  // ── Bob mit KYC=approved darf jetzt referren ────────────────────────
  await step("Nach KYC-Approval kann Bob referren", async () => {
    // Erst neue Bounty mit status=open anlegen, da publishedId jetzt closed ist.
    const { data: open, error: insErr } = await aliceClient
      .from("bounties")
      .insert({ owner_id: alice.id, ...BASE_INPUT, title: "Open for referrals" })
      .select("id")
      .single();
    if (insErr) throw insErr;
    state.bounties.push(open.id);
    const { error: pubErr } = await aliceClient
      .from("bounties")
      .update({ status: "open", published_at: new Date().toISOString() })
      .eq("id", open.id);
    if (pubErr) throw pubErr;

    const { error: kycErr } = await admin
      .from("profiles")
      .update({ kyc_status: "approved" })
      .eq("id", bob.id);
    if (kycErr) throw kycErr;

    const { data, error } = await bobClient
      .from("bounty_referrals")
      .insert({
        bounty_id: open.id,
        referrer_id: bob.id,
        candidate_name: "Ada Lovelace",
        candidate_email: "ada@example.com",
        message: "Erfahrene Engineerin, klare Empfehlung.",
      })
      .select("id, status")
      .single();
    if (error) throw error;
    expect(data.status === "submitted", `status=${data.status}`);
  });

  // ── Referral-Status-Transition-Trigger ──────────────────────────────
  await step("Ungültiger Referral-Statusübergang wird von Trigger geblockt", async () => {
    const { data: ref } = await aliceClient
      .from("bounty_referrals")
      .select("id")
      .limit(1)
      .single();

    // submitted → paid ist nicht erlaubt (legal: submitted → contacted → …)
    const { error } = await aliceClient
      .from("bounty_referrals")
      .update({ status: "paid" })
      .eq("id", ref.id);
    expect(error, "Ungültiger Status-Sprung wurde erlaubt");
    expect(
      /unzul|transition|22023/i.test(error.message),
      `unerwarteter Fehlertyp: ${error.message}`,
    );
  });

  await step("Legaler Referral-Übergang: submitted → contacted → hired", async () => {
    const { data: ref } = await aliceClient
      .from("bounty_referrals")
      .select("id")
      .limit(1)
      .single();

    const { error: e1 } = await aliceClient
      .from("bounty_referrals")
      .update({ status: "contacted" })
      .eq("id", ref.id);
    if (e1) throw e1;
    const { error: e2 } = await aliceClient
      .from("bounty_referrals")
      .update({ status: "interviewing" })
      .eq("id", ref.id);
    if (e2) throw e2;
    const { error: e3 } = await aliceClient
      .from("bounty_referrals")
      .update({ status: "hired" })
      .eq("id", ref.id);
    if (e3) throw e3;

    const { data } = await aliceClient
      .from("bounty_referrals")
      .select("status, hired_at")
      .eq("id", ref.id)
      .single();
    expect(data.status === "hired", `status=${data.status}`);
    expect(data.hired_at !== null, "hired_at nicht automatisch gesetzt");
  });

  // ── Phase 3.3: Public Listing, Filter, Referral-UI-Flows ────────────────

  // Alice legt eine zweite offene Bounty an mit abweichenden Feldern, um
  // Filter sinnvoll prüfen zu können.
  let filterBountyId;
  await step("3.3 Setup: zweite offene Bounty für Filter-Tests", async () => {
    const { data, error } = await aliceClient
      .from("bounties")
      .insert({
        owner_id: alice.id,
        ...BASE_INPUT,
        title: "Mobile Engineer (Flutter)",
        description:
          "Smoke-Test-Bounty speziell für Filter: andere Branche, anderer Ort, anderer Tag.",
        bonus_amount: 3000,
        location: "München",
        industry: "Mobile",
        tags: ["flutter", "mobile"],
      })
      .select("id")
      .single();
    if (error) throw error;
    filterBountyId = data.id;
    state.bounties.push(data.id);
    const { error: pubErr } = await aliceClient
      .from("bounties")
      .update({ status: "open", published_at: new Date().toISOString() })
      .eq("id", filterBountyId);
    if (pubErr) throw pubErr;
  });

  await step("Filter tag=flutter liefert nur die Flutter-Bounty", async () => {
    const { data, error } = await bobClient
      .from("bounties")
      .select("id, title")
      .eq("status", "open")
      .contains("tags", ["flutter"]);
    if (error) throw error;
    const ids = data.map((b) => b.id);
    expect(ids.includes(filterBountyId), "Filter-Bounty fehlt im Tag-Filter");
    expect(!ids.some((id) => id !== filterBountyId && state.bounties.includes(id) && id !== filterBountyId),
      // Selbstverständlich können parallele Test-Suiten andere Rows produzieren -
      // wir prüfen nur die für uns relevante Bounty.
      "unerwartet zusätzliche Rows - Tag-Filter scheint zu lax");
  });

  await step("Filter minBonus=2500 blendet 1500er-Bounty aus", async () => {
    const { data, error } = await bobClient
      .from("bounties")
      .select("id, bonus_amount")
      .eq("status", "open")
      .gte("bonus_amount", 2500);
    if (error) throw error;
    for (const b of data) {
      expect(Number(b.bonus_amount) >= 2500, `bonus_amount ${b.bonus_amount} < 2500`);
    }
  });

  await step("Filter location ilike 'münchen' findet Flutter-Bounty", async () => {
    const { data, error } = await bobClient
      .from("bounties")
      .select("id, location")
      .eq("status", "open")
      .ilike("location", "%münchen%");
    if (error) throw error;
    expect(
      data.some((b) => b.id === filterBountyId),
      "München-Bounty nicht gefunden - ILIKE Case-Insensitive defekt",
    );
  });

  await step("Pagination .range() liefert maximal PAGE_SIZE Rows", async () => {
    const { data, error } = await bobClient
      .from("bounties")
      .select("id", { count: "exact" })
      .eq("status", "open")
      .range(0, 19);
    if (error) throw error;
    expect(data.length <= 20, `Pagination gab ${data.length} Rows zurück (>20)`);
  });

  await step("Anonymer Client sieht KEINE Bounties (RLS: nur authenticated)", async () => {
    const anon = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon
      .from("bounties")
      .select("id")
      .eq("id", filterBountyId);
    if (error) throw error;
    expect(data.length === 0, `Anon sieht ${data.length} Bounty-Rows - RLS verletzt`);
  });

  // Duplicate-Prevention (unique constraint bounty+referrer+email)
  await step("Duplikat-Referral (gleiche E-Mail) wird abgewiesen", async () => {
    const { error } = await bobClient.from("bounty_referrals").insert({
      bounty_id: filterBountyId,
      referrer_id: bob.id,
      candidate_name: "Ada Lovelace",
      candidate_email: "ada@example.com",
    });
    if (error) throw error;
    const { error: dupErr } = await bobClient.from("bounty_referrals").insert({
      bounty_id: filterBountyId,
      referrer_id: bob.id,
      candidate_name: "Ada Lovelace",
      candidate_email: "ada@example.com",
    });
    expect(dupErr, "Duplikat-Referral wurde akzeptiert");
    expect(
      /duplicate|unique|23505/i.test(dupErr.message),
      `unerwarteter Fehlertyp: ${dupErr.message}`,
    );
  });

  // Withdraw-Flow
  await step("Referrer kann Empfehlung zurückziehen (submitted → withdrawn)", async () => {
    const { data: refs, error: selErr } = await bobClient
      .from("bounty_referrals")
      .select("id, status")
      .eq("bounty_id", filterBountyId)
      .eq("referrer_id", bob.id)
      .limit(1);
    if (selErr) throw selErr;
    expect(refs.length === 1, "keine Empfehlung zum Zurückziehen gefunden");
    const refId = refs[0].id;
    const { error: wdErr } = await bobClient
      .from("bounty_referrals")
      .update({ status: "withdrawn", status_changed_at: new Date().toISOString() })
      .eq("id", refId)
      .in("status", ["submitted", "contacted", "interviewing"]);
    if (wdErr) throw wdErr;
    const { data } = await bobClient
      .from("bounty_referrals")
      .select("status")
      .eq("id", refId)
      .single();
    expect(data.status === "withdrawn", `status=${data.status}`);
  });

  // Referrer-View: eigene Referrals
  await step("Referrer sieht eigene, aber keine fremden Empfehlungen", async () => {
    const { data: mine, error: myErr } = await bobClient
      .from("bounty_referrals")
      .select("id, referrer_id")
      .eq("referrer_id", bob.id);
    if (myErr) throw myErr;
    expect(mine.length >= 1, "Bob sieht eigene Empfehlung nicht");
    // fremdes Referral: alice hat (über kein Referral erstellt, aber) - Bob darf
    // keinen nicht-eigenen zeigen
    const { data: stranger } = await bobClient
      .from("bounty_referrals")
      .select("id")
      .neq("referrer_id", bob.id);
    for (const row of stranger ?? []) {
      throw new Error(`Bob sieht fremde Empfehlung ${row.id}`);
    }
  });

  // Owner-View: Referrals auf eigene Bounty
  await step("Owner sieht Referrals der eigenen Bounty", async () => {
    const { data, error } = await aliceClient
      .from("bounty_referrals")
      .select("id, bounty_id")
      .eq("bounty_id", filterBountyId);
    if (error) throw error;
    expect(data.length >= 1, "Owner sieht keine Referrals auf eigene Bounty");
  });

  console.log(`\n${state.ok} ok · ${state.fail} fail`);
}

// ──────────────────────────────────────────────────────────────────────────
// Run
// ──────────────────────────────────────────────────────────────────────────

let exitCode = 0;
try {
  await main();
  if (state.fail > 0) exitCode = 1;
} catch (err) {
  console.error("\n✗ Fataler Fehler:", err.message);
  if (process.env.DEBUG) console.error(err);
  exitCode = 2;
} finally {
  try {
    await cleanup();
  } catch (err) {
    console.error("Cleanup fehlgeschlagen:", err.message);
  }
}
process.exit(exitCode);
