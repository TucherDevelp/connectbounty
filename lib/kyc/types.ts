/**
 * KYC Provider – Adapter-Pattern.
 *
 * Jeder externe Verifikations-Dienst (Ballerine, Onfido, Veriff, …) wird
 * hinter diesem Interface gekapselt. UI, Actions und Webhook wissen nichts
 * von der konkreten Implementierung – sie sprechen ausschließlich gegen
 * diesen Vertrag.
 *
 * Warum? Wir wollen:
 *   1. jederzeit den Provider wechseln können, ohne UI-/Business-Code zu ändern;
 *   2. in Dev/Test ohne externen Dienst entwickeln (MockProvider);
 *   3. deterministische Unit-Tests schreiben (Provider injizierbar machen).
 */

import type { KycStatus } from "@/lib/supabase/types";

export type KycWebhookEventType =
  | "applicantPending"
  | "applicantReviewed"
  | "applicantApproved"
  | "applicantRejected"
  | "applicantExpired";

export interface KycStartSession {
  /** Vom Provider vergebene eindeutige ID des Antrags. */
  applicantId: string;
  /** Level (z.B. "basic-kyc-level") – wird in DB mitgespeichert. */
  levelName: string;
  /**
   * Kurzlebiges Access-Token für das Web-SDK des jeweiligen Providers.
   * Beim MockProvider leer – die UI zeigt dann stattdessen einen Dev-Panel.
   */
  accessToken: string | null;
  /**
   * Gibt an, ob dieser Provider eine native Simulations-Action im Dashboard
   * erlaubt (nur Dev/Mock).
   */
  devSimulatable: boolean;
}

export interface KycWebhookPayload {
  applicantId: string;
  type: KycWebhookEventType;
  nextStatus: KycStatus;
  rejectLabels?: string[];
  raw: unknown;
}

export interface KycProvider {
  readonly name: "mock" | "ballerine";

  /**
   * Startet einen neuen KYC-Antrag für den gegebenen User oder liefert den
   * bestehenden offenen Antrag zurück. Muss idempotent sein.
   */
  startSession(userId: string): Promise<KycStartSession>;

  /**
   * Verifiziert Webhook-Signatur und übersetzt das rohe Event in ein
   * normalisiertes `KycWebhookPayload`. Wirft, wenn die Signatur ungültig ist.
   */
  parseWebhook(
    rawBody: string,
    headers: Readonly<Record<string, string>>,
  ): KycWebhookPayload;
}
