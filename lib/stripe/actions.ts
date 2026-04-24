"use server";

import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/roles";
import { startConnectOnboarding } from "./connect";
import { actionError, actionOk, type ActionState } from "@/lib/auth/action-result";

/**
 * Startet das Stripe Connect Express Onboarding und leitet direkt weiter.
 * Wird vom "Jetzt verbinden"-Button aufgerufen.
 */
export async function startStripeConnectAction(): Promise<void> {
  const user = await requireUser();
  if (!user.email) redirect("/login");

  let onboardingUrl: string;
  try {
    onboardingUrl = await startConnectOnboarding(user.id, user.email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    redirect(`/payouts?error=${encodeURIComponent(msg)}`);
  }

  redirect(onboardingUrl);
}

/**
 * Synchronisiert den Connect-Account-Status manuell (nach Rückkehr
 * vom Onboarding oder bei manuellem Refresh).
 */
export async function refreshStripeStatusAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: ActionState,
): Promise<ActionState> {
  const user = await requireUser();

  const { getConnectAccountStatus, syncConnectAccount } = await import("./connect");
  const status = await getConnectAccountStatus(user.id);

  if (!status?.stripeAccountId) {
    return actionError("Kein Stripe-Account gefunden. Bitte starte das Onboarding.");
  }

  try {
    await syncConnectAccount(status.stripeAccountId);
  } catch (err) {
    return actionError(err instanceof Error ? err.message : "Synchronisation fehlgeschlagen.");
  }

  revalidatePath("/payouts");
  return actionOk("Status aktualisiert.");
}
