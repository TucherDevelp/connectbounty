#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "DemoPass-1234!";

async function deleteExistingDemoUsers() {
  let page = 1;
  const perPage = 200;
  const targets = [];
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      if (u.email && u.email.endsWith("@test-split.local")) targets.push(u.id);
    }
    if (data.users.length < perPage) break;
    page++;
  }
  for (const id of targets) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  if (targets.length > 0) {
    console.log(`  · ${targets.length} alte Test-User entfernt`);
  }
}

async function createUser({ email, name, kyc, referrerId = null }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  const id = data.user.id;
  
  const updates = { kyc_status: kyc };
  if (referrerId) updates.referrer_id = referrerId;

  const { error: upErr } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", id);
  
  if (upErr) throw new Error(`profile update ${email}: ${upErr.message}`);
  return id;
}

async function main() {
  console.log("▶  Seeding Test-Daten für Split-Logik …\n");
  await deleteExistingDemoUsers();

  // 1. Create meta referrers (the ones who get the 2.5% each)
  const metaAId = await createUser({
    email: "meta_a@test-split.local",
    name: "Meta Referrer A",
    kyc: "approved",
  });
  const metaBId = await createUser({
    email: "meta_b@test-split.local",
    name: "Meta Referrer B",
    kyc: "approved",
  });

  // 2. Create the main actors
  const ownerId = await createUser({
    email: "owner@test-split.local",
    name: "Bounty Owner",
    kyc: "approved",
  });
  
  const referrerAId = await createUser({
    email: "referrer_a@test-split.local",
    name: "Referrer (Inserent)",
    kyc: "approved",
    referrerId: metaAId, // Linked to Meta A
  });

  const candidateId = await createUser({
    email: "candidate@test-split.local",
    name: "Kandidat",
    kyc: "approved",
    referrerId: metaBId, // Linked to Meta B
  });

  // 3. Create Bounty
  const { data: bounty, error: bErr } = await admin
    .from("bounties")
    .insert({
      owner_id: ownerId,
      title: "Split Test Bounty",
      description: "Bounty zum Testen der Referrer-Split-Logik.",
      bonus_amount: 1000,
      bonus_currency: "EUR",
      status: "open",
      published_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (bErr) throw new Error(`insert bounty: ${bErr.message}`);

  // 4. Create Referral
  const { data: referral, error: rErr } = await admin
    .from("bounty_referrals")
    .insert({
      bounty_id: bounty.id,
      referrer_id: referrerAId,
      candidate_user_id: candidateId,
      candidate_name: "Kandidat",
      candidate_email: "candidate@test-split.local",
      status: "awaiting_hire_proof",
      company_name: "Test Corp",
      company_billing_email: "billing@testcorp.com",
    })
    .select("id")
    .single();

  if (rErr) throw new Error(`insert referral: ${rErr.message}`);

  await admin.from("bounty_referrals").update({
    status: "awaiting_claim",
    hire_proof_uploaded_at: new Date().toISOString()
  }).eq("id", referral.id);

  await admin.from("bounty_referrals").update({
    status: "awaiting_payout_account",
    claim_confirmed_at: new Date().toISOString()
  }).eq("id", referral.id);

  // 5. Let's do another one with only 1 referrer (Meta A only)
  const candidate2Id = await createUser({
    email: "candidate_noref@test-split.local",
    name: "Kandidat 2 (ohne Referrer)",
    kyc: "approved",
  });

  const { data: referral2, error: rErr2 } = await admin
    .from("bounty_referrals")
    .insert({
      bounty_id: bounty.id,
      referrer_id: referrerAId,
      candidate_user_id: candidate2Id,
      candidate_name: "Kandidat 2",
      candidate_email: "candidate_noref@test-split.local",
      status: "awaiting_hire_proof",
      company_name: "Test Corp",
      company_billing_email: "billing@testcorp.com",
    })
    .select("id")
    .single();

  if (rErr2) throw new Error(`insert referral 2: ${rErr2.message}`);

  await admin.from("bounty_referrals").update({
    status: "awaiting_claim",
    hire_proof_uploaded_at: new Date().toISOString()
  }).eq("id", referral2.id);

  await admin.from("bounty_referrals").update({
    status: "awaiting_payout_account",
    claim_confirmed_at: new Date().toISOString()
  }).eq("id", referral2.id);

  console.log("Erfolgreich! Accounts erstellt:\n");
  console.log("  owner@test-split.local        - Ersteller der Bounty");
  console.log("  referrer_a@test-split.local   - Empfehler (wurde von Meta A geworben)");
  console.log("  candidate@test-split.local    - Kandidat 1 (wurde von Meta B geworben)");
  console.log("  meta_a@test-split.local       - Empfehler von referrer_a (erhält 2.5%)");
  console.log("  meta_b@test-split.local       - Empfehler von candidate (erhält 2.5%)");
  console.log("");
  console.log(`Bounty ID: ${bounty.id}`);
  console.log(`Referral 1 (2 Referrers): ${referral.id}`);
  console.log(`Referral 2 (1 Referrer):  ${referral2.id}`);
  console.log(`\nLogin mit: ${PASSWORD}`);
}

main().catch(console.error);
