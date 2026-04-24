import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { syncConnectAccount } from "@/lib/stripe/connect";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

/**
 * POST /api/stripe/webhooks
 *
 * Verarbeitet Stripe-Webhooks:
 *   • account.updated                → Sync Connect-Account-Status
 *   • transfer.created               → Payout-Status auf 'processing' setzen
 *   • transfer.paid  / payout.paid   → Payout-Status auf 'paid' setzen
 *   • transfer.failed / payout.failed→ Payout-Status auf 'failed' setzen
 *
 * Signatur-Verifikation via STRIPE_WEBHOOK_SECRET (Pflicht in Produktion).
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
    // Lokale Entwicklung ohne Webhook-Secret: JSON direkt parsen (nur dev)
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
      // ── Connect-Account-Status aktualisieren ──────────────────────────
      case "account.updated": {
        const account = event.data.object as import("stripe").Stripe.Account;
        await syncConnectAccount(account.id);
        break;
      }

      // ── Transfer angelegt → Payout auf 'processing' ───────────────────
      case "transfer.created": {
        const transfer = event.data.object as import("stripe").Stripe.Transfer;
        const referralId = transfer.metadata?.referral_id;
        if (referralId) {
          await sb
            .from("payouts")
            .update({ status: "processing", stripe_transfer_id: transfer.id })
            .eq("referral_id", referralId)
            .eq("status", "pending");
        }
        break;
      }

      // ── Payout erfolgreich ────────────────────────────────────────────
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

      // ── Payout fehlgeschlagen ─────────────────────────────────────────
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
        // Unbekannte Events ignorieren
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Handler error";
    console.error("[stripe-webhook] error:", msg, event.type);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
