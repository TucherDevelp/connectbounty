"use server";

import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { clientEnv } from "@/lib/env";
import {
  loginSchema,
  registerSchema,
  requestResetSchema,
  updatePasswordSchema,
} from "./schemas";
import {
  actionError,
  actionOk,
  fieldErrorsFromZod,
  type ActionState,
} from "./action-result";

/**
 * Server Actions für Auth-Flows.
 *
 * Wichtig:
 *   • Kein try/catch um redirect() – Next nutzt einen speziellen Throw-Wert.
 *   • Bei Fehlern NIE die Supabase-Originalmeldung 1:1 zurückgeben (kann
 *     E-Mail-Existenz preisgeben). Stattdessen generische Texte + Logging.
 *   • Erfolgreiche Mutationen revalidieren den App-Layer-Pfad, damit
 *     getUser()-Caches im Layout invalidiert werden.
 */

function safeFormDataToObject(fd: FormData): Record<string, FormDataEntryValue> {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

// ── Login ──────────────────────────────────────────────────────────────────

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    return actionError("Bitte prüfe deine Eingaben.", fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Kein Leak von "user not found" vs "wrong password" – generischer Text.
    return actionError("E-Mail oder Passwort ist nicht korrekt.");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

// ── Register ───────────────────────────────────────────────────────────────

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    return actionError("Bitte prüfe deine Eingaben.", fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();
  const env = clientEnv();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: { display_name: parsed.data.displayName },
    },
  });

  if (error) {
    return actionError("Registrierung fehlgeschlagen. Bitte später erneut versuchen.");
  }

  return actionOk(
    "Wir haben dir eine E-Mail zur Bestätigung geschickt. Bitte prüfe dein Postfach.",
  );
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ── Password-Reset anfordern ───────────────────────────────────────────────

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestResetSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    return actionError("Bitte prüfe deine Eingabe.", fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();
  const env = clientEnv();
  // Wir ignorieren den Fehler hier bewusst und antworten immer gleich,
  // damit die Existenz einer E-Mail nicht enumerierbar ist.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/reset/confirm`,
  });

  return actionOk(
    "Falls die Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt.",
  );
}

// ── Neues Passwort setzen (nach Reset-Link-Klick) ─────────────────────────

export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    return actionError("Bitte prüfe deine Eingaben.", fieldErrorsFromZod(parsed.error.issues));
  }

  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return actionError(
      "Der Reset-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return actionError("Passwort konnte nicht aktualisiert werden.");
  }

  revalidatePath("/", "layout");
  return actionOk("Passwort aktualisiert. Du kannst dich jetzt einloggen.");
}
