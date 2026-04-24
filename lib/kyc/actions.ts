"use server";

import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createHmac } from "node:crypto";
import { requireUser } from "@/lib/auth/roles";
import { getKycProvider } from "./provider";
import { serverEnv, clientEnv } from "@/lib/env";
import { actionError, actionOk, type ActionState } from "@/lib/auth/action-result";
import type { KycWebhookEventType } from "./types";

/**
 * Startet einen KYC-Antrag für den eingeloggten User und leitet auf die
 * KYC-Seite weiter. Idempotent: offene Anträge werden recycelt.
 */
export async function startKycAction(): Promise<void> {
  const user = await requireUser();
  await getKycProvider().startSession(user.id);
  revalidatePath("/", "layout");
  redirect("/kyc");
}

/**
 * Dev-only: simuliert eine Provider-Entscheidung, indem dieselbe Route
 * aufgerufen wird, die auch der echte Webhook-Handler benutzt. So testen
 * wir den kompletten Pfad (Signatur → DB → Profil-Statusupdate) ohne
 * externen Provider.
 *
 * Produktion: diese Action ist durch den NODE_ENV-Check geschützt.
 */
export async function simulateKycDecisionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const env = serverEnv();
  if (env.NODE_ENV === "production" || env.KYC_PROVIDER !== "mock") {
    return actionError("Simulation ist nur im Mock-Modus verfügbar.");
  }

  const decision = String(formData.get("decision") ?? "");
  const applicantId = String(formData.get("applicantId") ?? "");

  const decisionMap: Record<string, KycWebhookEventType> = {
    approve: "applicantApproved",
    reject: "applicantRejected",
    expire: "applicantExpired",
  };
  const eventType = decisionMap[decision];
  if (!eventType || !applicantId) {
    return actionError("Ungültige Simulations-Parameter.");
  }

  const body = JSON.stringify({
    applicantId,
    type: eventType,
    rejectLabels: eventType === "applicantRejected" ? ["SIMULATED_REJECT"] : undefined,
  });

  const signature = createHmac("sha256", env.KYC_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  const webhookUrl = `${clientEnv().NEXT_PUBLIC_SITE_URL}/api/webhooks/kyc`;
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-kyc-signature": signature },
    body,
  });

  if (!res.ok) {
    return actionError(`Webhook-Aufruf fehlgeschlagen (${res.status}).`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/kyc");
  return actionOk("Entscheidung simuliert - Status wurde aktualisiert.");
}
