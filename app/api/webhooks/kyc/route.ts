import { NextResponse } from "next/server";
import { getKycProvider } from "@/lib/kyc/provider";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/auth/roles";
import type { AuditAction } from "@/lib/supabase/types";

/**
 * KYC-Webhook-Endpoint.
 *
 * Verhalten:
 *   1. Provider verifiziert HMAC-Signatur (wirft bei Invalid).
 *   2. Payload wird normalisiert (KycWebhookPayload).
 *   3. update_kyc_status() aktualisiert Applicant + Profile atomar.
 *   4. Audit-Log erhält das entsprechende kyc.*-Event.
 *
 * Wichtig:
 *   • service_role-Client umgeht RLS (nur hier erlaubt - Handler ist nicht
 *     an eine User-Session gebunden).
 *   • Wir antworten mit klaren HTTP-Status, damit Ballerine/Mock retries sinnvoll
 *     einsortieren können.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  const provider = getKycProvider();

  let payload;
  try {
    payload = provider.parseWebhook(rawBody, headers);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid" },
      { status: 401 },
    );
  }

  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("update_kyc_status", {
    p_applicant_id: payload.applicantId,
    p_status: payload.nextStatus,
    p_review_result: payload.raw as never,
    p_reject_labels: payload.rejectLabels ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit-Log schreiben (best effort, keine Fehler-Propagation)
  const auditAction: AuditAction | null =
    payload.nextStatus === "approved"
      ? "kyc.approved"
      : payload.nextStatus === "rejected"
        ? "kyc.rejected"
        : payload.nextStatus === "expired"
          ? "kyc.expired"
          : payload.nextStatus === "pending"
            ? "kyc.submitted"
            : null;

  if (auditAction) {
    try {
      // Actor ist kein User, sondern das System → direkter Insert via service_role
      await supabase.from("audit_logs").insert({
        actor_id: null,
        action: auditAction,
        metadata: { applicantId: payload.applicantId, provider: provider.name },
      });
    } catch {
      // still
    }
    void logAuditEvent;
  }

  return NextResponse.json({ ok: true });
}
