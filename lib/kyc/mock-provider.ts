import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import type {
  KycProvider,
  KycStartSession,
  KycWebhookEventType,
  KycWebhookPayload,
} from "./types";
import type { KycStatus } from "@/lib/supabase/types";

/**
 * MockProvider – vollständiger KYC-Flow ohne externen Dienst.
 *
 * Verhalten:
 *   • startSession legt einen Eintrag in kyc_applicants an (status=pending),
 *     falls der User noch keinen offenen Antrag hat. Sonst wird der
 *     bestehende zurückgeliefert (idempotent).
 *   • Webhooks können im Dev-Dashboard manuell simuliert werden: dort wird
 *     ein POST an /api/webhooks/kyc mit gültigem HMAC abgesetzt.
 *   • Die Webhook-Signatur folgt dem gleichen Schema wie der echte
 *     BallerineProvider (HMAC-SHA256 über den Raw-Body), damit der Tausch
 *     später nur eine Zeile ist.
 */
export class MockProvider implements KycProvider {
  readonly name = "mock" as const;

  async startSession(userId: string): Promise<KycStartSession> {
    const supabase = getSupabaseServiceRoleClient();

    // Offene Anträge (pending) recyceln – verhindert endlose "pending"-Leichen
    // wenn der User die Seite mehrmals öffnet.
    const { data: existing, error: existingErr } = await supabase
      .from("kyc_applicants")
      .select("applicant_id, level_name, status")
      .eq("user_id", userId)
      .in("status", ["pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) throw existingErr;
    if (existing) {
      return {
        applicantId: existing.applicant_id,
        levelName: existing.level_name,
        accessToken: null,
        devSimulatable: true,
      };
    }

    const applicantId = `mock_${userId.slice(0, 8)}_${Date.now().toString(36)}`;
    const levelName = "mock-basic";

    const { error } = await supabase.from("kyc_applicants").insert({
      user_id: userId,
      applicant_id: applicantId,
      level_name: levelName,
      status: "pending",
    });
    if (error) throw error;

    // profiles.kyc_status auf 'pending' setzen
    await supabase
      .from("profiles")
      .update({ kyc_status: "pending" as KycStatus })
      .eq("id", userId);

    return { applicantId, levelName, accessToken: null, devSimulatable: true };
  }

  parseWebhook(rawBody: string, headers: Record<string, string>): KycWebhookPayload {
    const signature = headers["x-kyc-signature"] ?? headers["X-Kyc-Signature"];
    if (!signature) throw new Error("missing signature header");

    const secret = serverEnv().KYC_WEBHOOK_SECRET;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("invalid signature");
    }

    const payload = JSON.parse(rawBody) as {
      applicantId?: unknown;
      type?: unknown;
      rejectLabels?: unknown;
    };

    if (typeof payload.applicantId !== "string" || typeof payload.type !== "string") {
      throw new Error("invalid payload shape");
    }

    const type = payload.type as KycWebhookEventType;
    const nextStatus = mapEventToStatus(type);

    return {
      applicantId: payload.applicantId,
      type,
      nextStatus,
      rejectLabels: Array.isArray(payload.rejectLabels)
        ? payload.rejectLabels.filter((x): x is string => typeof x === "string")
        : undefined,
      raw: payload,
    };
  }
}

function mapEventToStatus(type: KycWebhookEventType): KycStatus {
  switch (type) {
    case "applicantApproved":
    case "applicantReviewed":
      return "approved";
    case "applicantRejected":
      return "rejected";
    case "applicantExpired":
      return "expired";
    case "applicantPending":
    default:
      return "pending";
  }
}
