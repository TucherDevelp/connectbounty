import "server-only";

import type {
  KycProvider,
  KycStartSession,
  KycWebhookPayload,
} from "./types";

/**
 * BallerineProvider – Integration gegen das Open-Source-KYC-Framework
 * Ballerine (https://github.com/ballerine-io/ballerine).
 *
 * STATUS: STUB. Wird befüllt, sobald eine Ballerine-Instanz (Cloud oder
 * selbst gehostet) verfügbar ist. Benötigte Env-Variablen:
 *
 *   BALLERINE_API_URL       – Base-URL des Ballerine Workflows-Service
 *   BALLERINE_API_KEY       – serverseitiger API-Key
 *   BALLERINE_WORKFLOW_ID   – Workflow-Definition für den Standard-KYC-Flow
 *
 * Geplante Calls:
 *   startSession(userId)
 *     → POST {API_URL}/workflows  (erstellt eine Workflow-Run-Instanz)
 *     → Liefert workflowRunId als applicantId + Web-SDK-Token
 *
 *   parseWebhook(rawBody, headers)
 *     → verifiziert HMAC (Header "ballerine-signature") gegen
 *       BALLERINE_WEBHOOK_SECRET, mapped eventType auf KycStatus.
 *
 * Der Adapter-Vertrag steht bereits – UI, Actions und Webhook-Route bleiben
 * unverändert, sobald die Implementierung hier ausgefüllt wird.
 */
export class BallerineProvider implements KycProvider {
  readonly name = "ballerine" as const;

  async startSession(_userId: string): Promise<KycStartSession> {
    void _userId;
    throw new Error(
      "BallerineProvider ist noch nicht implementiert. " +
        "Setze KYC_PROVIDER=mock, bis eine Ballerine-Instanz verbunden ist.",
    );
  }

  parseWebhook(_rawBody: string, _headers: Record<string, string>): KycWebhookPayload {
    void _rawBody;
    void _headers;
    throw new Error(
      "BallerineProvider ist noch nicht implementiert. " +
        "Setze KYC_PROVIDER=mock, bis eine Ballerine-Instanz verbunden ist.",
    );
  }
}
