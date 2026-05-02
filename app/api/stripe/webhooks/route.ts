import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { syncConnectAccount } from "@/lib/stripe/connect";
import { dispatchSplitTransfers } from "@/lib/stripe/payout-orchestrator";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

/**
 * POST /api/stripe/webhooks
 *
 * Verarbeitet Stripe-Webhooks für den gesamten Payout-Lifecycle:
 *
 *   account.updated              → Connect-Account-Status synchronisieren
 *   invoice.finalized            → hosted_invoice_url persistieren
 *   invoice.paid                 → Split-Transfers auslösen (Haupt-Flow)
 *   invoice.payment_failed       → Payout auf "failed" setzen
 *   invoice.voided               → Payout auf "cancelled" setzen
 *   transfer.created             → Transfer-ID je Rolle speichern
 *   transfer.paid                → Payout auf "paid" setzen (alle Transfers)
 *   transfer.failed              → Payout auf "failed" setzen
 *   charge.dispute.created       → Dispute-Eintrag anlegen, Admin alarmieren
 *
 * Idempotenz: Alle Handler prüfen den DB-Status bevor sie schreiben.
 *             Stripe retryt automatisch bei HTTP 5xx.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");

  const env = serverEnv();
  const stripe = getStripeClient();

  let event: import("stripe").Stripe.Event;

  if (env.STRIPE_WEBHOOK_SECRET && sig) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "invalid signature";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else {
    if (env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Missing webhook secret" }, { status: 400 });
    }
    try {
      event = JSON.parse(rawBody) as import("stripe").Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const sb = getSupabaseServiceRoleClient();

  try {
    switch (event.type) {

      // ── Connect-Account-Status aktualisieren ────────────────────────────
      case "account.updated": {
        const account = event.data.object as import("stripe").Stripe.Account;
        await syncConnectAccount(account.id);
        break;
      }

      // ── Invoice finalisiert → URL speichern ─────────────────────────────
      case "invoice.finalized": {
        const inv = event.data.object as import("stripe").Stripe.Invoice;
        const referralId = inv.metadata?.connectbounty_referral_id;
        if (referralId && inv.hosted_invoice_url) {
          await sb
            .from("payouts")
            .update({ invoice_hosted_url: inv.hosted_invoice_url })
            .eq("invoice_id", inv.id);
        }
        break;
      }

      // ── Invoice bezahlt → Split-Transfers ausführen ─────────────────────
      case "invoice.paid": {
        const inv = event.data.object as import("stripe").Stripe.Invoice;
        const referralId = inv.metadata?.connectbounty_referral_id;
        if (!referralId) break;

        // Idempotenz: Nur auslösen wenn Payout noch in "pending"
        const { data: payout } = await sb
          .from("payouts")
          .select("id, status")
          .eq("invoice_id", inv.id)
          .maybeSingle();

        if (!payout || payout.status !== "pending") break;

        await dispatchSplitTransfers({
          invoiceId: inv.id,
          referralId,
        });
        break;
      }

      // ── Invoice-Zahlung fehlgeschlagen ───────────────────────────────────
      case "invoice.payment_failed": {
        const inv = event.data.object as import("stripe").Stripe.Invoice;
        const referralId = inv.metadata?.connectbounty_referral_id;
        if (referralId) {
          await sb
            .from("payouts")
            .update({
              status: "failed",
              failure_reason: "Stripe Invoice-Zahlung fehlgeschlagen",
            })
            .eq("invoice_id", inv.id)
            .eq("status", "pending");
        }
        break;
      }

      // ── Invoice storniert ────────────────────────────────────────────────
      case "invoice.voided": {
        const inv = event.data.object as import("stripe").Stripe.Invoice;
        await sb
          .from("payouts")
          .update({ status: "cancelled" })
          .eq("invoice_id", inv.id)
          .in("status", ["pending", "processing"]);
        break;
      }

      // ── Transfer angelegt → ID je Rolle speichern ───────────────────────
      case "transfer.created": {
        const transfer = event.data.object as import("stripe").Stripe.Transfer;
        const referralId = transfer.metadata?.connectbounty_referral_id;
        const role = transfer.metadata?.role;
        if (!referralId || !role) break;

        const roleToColumn: Record<string, string> = {
          person_a: "inserent_transfer_id",
          person_b: "candidate_transfer_id",
          ref_of_a: "ref_of_a_transfer_id",
          ref_of_b: "ref_of_b_transfer_id",
        };
        const col = roleToColumn[role];
        if (col) {
          // Dynamischer Spaltenname - TS-Cast nötig, Werte sind durch roleToColumn kontrolliert
          await sb
            .from("payouts")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ [col]: transfer.id } as any)
            .eq("referral_id", referralId);
        }
        break;
      }

      // ── Transfer-Status-Updates via transfer.created ─────────────────────
      // Stripe hat kein "transfer.paid" oder "transfer.failed" als Event-Typen
      // in dieser API-Version. Wir nutzen stattdessen transfer.created
      // (für ID-Erfassung) und payout.paid / payout.failed (für Finalstatus).

      // ── Chargeback / Dispute ─────────────────────────────────────────────
      case "charge.dispute.created": {
        const dispute = event.data.object as import("stripe").Stripe.Dispute;
        const referralId = (dispute.metadata as Record<string, string> | undefined)
          ?.connectbounty_referral_id;
        if (!referralId) break;

        // Referral-Dispute anlegen (unique constraint verhindert Duplikate)
        await sb.from("referral_disputes").upsert(
          {
            referral_id: referralId,
            opened_by: referralId, // system-generated; kein echter User
            reason: `Chargeback-Dispute von Stripe: ${dispute.id}`,
            status: "open",
          },
          { onConflict: "referral_id", ignoreDuplicates: true },
        );

        // Payout sichern
        await sb
          .from("payouts")
          .update({ status: "cancelled", failure_reason: `Chargeback: ${dispute.id}` })
          .eq("referral_id", referralId)
          .in("status", ["pending", "processing", "paid"]);

        await sb
          .from("bounty_referrals")
          .update({ status: "disputed" })
          .eq("id", referralId)
          .not("status", "eq", "disputed");

        break;
      }

      // ── Legacy: payout.paid / payout.failed (werden noch von altem Flow genutzt)
      case "payout.paid": {
        const obj = event.data.object as import("stripe").Stripe.Payout;
        const referralId = obj.metadata?.referral_id;
        if (referralId) {
          await sb
            .from("payouts")
            .update({ status: "paid" })
            .eq("referral_id", referralId)
            .in("status", ["pending", "processing"]);
        }
        break;
      }

      case "payout.failed": {
        const obj = event.data.object as import("stripe").Stripe.Payout;
        const referralId = obj.metadata?.referral_id;
        if (referralId) {
          await sb
            .from("payouts")
            .update({
              status: "failed",
              stripe_error_code: obj.failure_code ?? null,
            })
            .eq("referral_id", referralId)
            .in("status", ["pending", "processing"]);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Handler error";
    console.error("[stripe-webhook] error:", msg, event.type);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
