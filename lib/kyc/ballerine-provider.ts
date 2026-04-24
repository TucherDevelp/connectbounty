import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import type {
  KycProvider,
  KycStartSession,
  KycWebhookPayload,
  KycWebhookEventType,
} from "./types";
import type { KycStatus } from "@/lib/supabase/types";

/**
 * BallerineProvider - Integration gegen das Open-Source-KYC-Framework
 * Ballerine (https://github.com/ballerine-io/ballerine).
 *
 * Benötigte Env-Variablen:
 *   BALLERINE_API_URL        - Base-URL des Ballerine Workflow-Service
 *                              (z.B. https://api.ballerine.yourdomain.com)
 *   BALLERINE_API_KEY        - serverseitiger API-Key (Authorization: Bearer)
 *   BALLERINE_WORKFLOW_ID    - Workflow-Definition-ID für KYC
 *                              (z.B. "kyc-email-session-example")
 *   BALLERINE_WEBHOOK_SECRET - HMAC-Secret für Webhook-Signatur-Verifikation
 *
 * Ablauf:
 *   startSession(userId)
 *     1. Bestehenden offenen Antrag recyceln (idempotent)
 *     2. POST {API_URL}/api/v1/external/workflows/run
 *        → liefert workflowRuntimeId
 *     3. POST {API_URL}/api/v1/end-users/token
 *        → kurzlebiges Token für das Collection-Flow-SDK
 *     4. Rückgabe: applicantId = workflowRuntimeId, accessToken = SDK-Token
 *
 *   parseWebhook(rawBody, headers)
 *     → verifiziert HMAC-SHA256 (Header "ballerine-signature")
 *     → mapped eventType auf KycStatus
 *
 * Die Collection-Flow-URL wird vom KYC-Handler generiert:
 *   {BALLERINE_API_URL}/collection-flow?token={accessToken}
 */
export class BallerineProvider implements KycProvider {
  readonly name = "ballerine" as const;

  async startSession(userId: string): Promise<KycStartSession> {
    const env = serverEnv();
    const {
      BALLERINE_API_URL,
      BALLERINE_API_KEY,
      BALLERINE_WORKFLOW_ID,
    } = env;

    if (!BALLERINE_API_URL || !BALLERINE_API_KEY || !BALLERINE_WORKFLOW_ID) {
      throw new Error(
        "Ballerine ist nicht konfiguriert. " +
          "Setze BALLERINE_API_URL, BALLERINE_API_KEY und BALLERINE_WORKFLOW_ID in .env.local.",
      );
    }

    const supabase = getSupabaseServiceRoleClient();

    // Offenen Antrag recyceln - verhindert endlose Duplikate
    const { data: existing } = await supabase
      .from("kyc_applicants")
      .select("applicant_id, level_name, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Neues Access-Token für bestehenden Workflow-Run holen
      const token = await this.fetchEndUserToken(
        BALLERINE_API_URL,
        BALLERINE_API_KEY,
        existing.applicant_id,
      );
      return {
        applicantId: existing.applicant_id,
        levelName: existing.level_name,
        accessToken: token,
        devSimulatable: false,
      };
    }

    // Workflow-Run erstellen
    const workflowRuntimeId = await this.createWorkflowRun(
      BALLERINE_API_URL,
      BALLERINE_API_KEY,
      BALLERINE_WORKFLOW_ID,
      userId,
    );

    const levelName = BALLERINE_WORKFLOW_ID;

    // DB-Eintrag anlegen
    const { error } = await supabase.from("kyc_applicants").insert({
      user_id: userId,
      applicant_id: workflowRuntimeId,
      level_name: levelName,
      status: "pending",
    });
    if (error) throw error;

    // profiles.kyc_status auf 'pending' setzen
    await supabase
      .from("profiles")
      .update({ kyc_status: "pending" as KycStatus })
      .eq("id", userId);

    // SDK-Token holen
    const accessToken = await this.fetchEndUserToken(
      BALLERINE_API_URL,
      BALLERINE_API_KEY,
      workflowRuntimeId,
    );

    return {
      applicantId: workflowRuntimeId,
      levelName,
      accessToken,
      devSimulatable: false,
    };
  }

  parseWebhook(rawBody: string, headers: Readonly<Record<string, string>>): KycWebhookPayload {
    const env = serverEnv();
    const secret = env.BALLERINE_WEBHOOK_SECRET ?? env.KYC_WEBHOOK_SECRET;

    // Ballerine sendet die Signatur als "ballerine-signature: sha256=<hex>"
    const sigHeader =
      headers["ballerine-signature"] ??
      headers["x-ballerine-signature"] ??
      headers["x-kyc-signature"];

    if (!sigHeader) throw new Error("Fehlender Signatur-Header");

    const sigValue = sigHeader.startsWith("sha256=")
      ? sigHeader.slice(7)
      : sigHeader;

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sigValue, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Ungültige Webhook-Signatur");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;

    // Ballerine Webhook-Format:
    // { workflowRuntimeId, eventName, data: { status, ... } }
    // ODER (ältere Versionen):
    // { applicantId, type, ... }
    const applicantId =
      (payload.workflowRuntimeId as string | undefined) ??
      (payload.applicantId as string | undefined);

    if (!applicantId) throw new Error("Fehlende applicantId im Webhook-Payload");

    const eventName =
      (payload.eventName as string | undefined) ??
      (payload.type as string | undefined) ??
      "";

    const type = mapBallerineEvent(eventName);
    const nextStatus = mapEventToStatus(type);

    const rejectLabels: string[] = [];
    const data = payload.data as Record<string, unknown> | undefined;
    if (data?.rejectLabels && Array.isArray(data.rejectLabels)) {
      rejectLabels.push(
        ...(data.rejectLabels as unknown[]).filter((x): x is string => typeof x === "string"),
      );
    }

    return {
      applicantId,
      type,
      nextStatus,
      rejectLabels: rejectLabels.length > 0 ? rejectLabels : undefined,
      raw: payload,
    };
  }

  // ── Private Hilfsmethoden ──────────────────────────────────────────────────

  private async createWorkflowRun(
    apiUrl: string,
    apiKey: string,
    workflowDefinitionId: string,
    userId: string,
  ): Promise<string> {
    const res = await fetch(`${apiUrl}/api/v1/external/workflows/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        workflowDefinitionId,
        context: {
          entity: {
            type: "individual",
            id: userId,
            data: {},
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ballerine workflow/run fehlgeschlagen (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { workflowRuntimeId?: string; id?: string };
    const id = json.workflowRuntimeId ?? json.id;
    if (!id) throw new Error("Ballerine lieferte keine workflowRuntimeId");
    return id;
  }

  private async fetchEndUserToken(
    apiUrl: string,
    apiKey: string,
    workflowRuntimeId: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(`${apiUrl}/api/v1/collection-flow/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ workflowRuntimeId }),
      });

      if (!res.ok) return null;
      const json = (await res.json()) as { token?: string };
      return json.token ?? null;
    } catch {
      return null;
    }
  }
}

// ── Event-Mapping ──────────────────────────────────────────────────────────

function mapBallerineEvent(eventName: string): KycWebhookEventType {
  const name = eventName.toLowerCase();
  if (name.includes("approv") || name.includes("complet")) return "applicantApproved";
  if (name.includes("reject") || name.includes("declin")) return "applicantRejected";
  if (name.includes("expir")) return "applicantExpired";
  if (name.includes("review") || name.includes("manual")) return "applicantReviewed";
  return "applicantPending";
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
