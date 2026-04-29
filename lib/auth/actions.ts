"use server";

import "server-only";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { clientEnv } from "@/lib/env";
import { logAuditEvent } from "./roles";
import type { AuditAction, Json } from "@/lib/supabase/types";
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
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t } from "@/lib/i18n";

/**
 * Server Actions für Auth-Flows.
 *
 * Wichtig:
 *   • Kein try/catch um redirect() - Next nutzt einen speziellen Throw-Wert.
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

/**
 * Audit-Logging darf den Auth-Flow niemals blockieren. Wir fangen Fehler
 * still ab, denn die Quelle der Wahrheit (auth) ist bereits geschrieben -
 * ein verlorener Audit-Eintrag ist hässlich, aber nicht security-kritisch
 * (es gibt zusätzlich Postgres-seitige Trigger in späteren Phasen).
 */
async function auditSafe(action: AuditAction, metadata: Json = {}): Promise<void> {
  try {
    await logAuditEvent({ action, metadata });
  } catch {
    // bewusst geschluckt
  }
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
    // Kein Leak von "user not found" vs "wrong password" - generischer Text.
    return actionError("E-Mail oder Passwort ist nicht korrekt.");
  }

  await auditSafe("user.login", { provider: "password" });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ── Register ───────────────────────────────────────────────────────────────

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const parsed = registerSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    return actionError(t(lang, "profile_action_input_invalid"), fieldErrorsFromZod(parsed.error.issues));
  }

  const serviceSb = getSupabaseServiceRoleClient();
  const normalizedAlias = parsed.data.displayName.trim();
  const { data: aliasTaken } = await serviceSb
    .from("profiles")
    .select("id")
    .ilike("display_name", normalizedAlias)
    .limit(1)
    .maybeSingle();
  if (aliasTaken) {
    return actionError(t(lang, "profile_action_input_invalid"), {
      displayName: t(lang, "profile_error_display_name_taken"),
    });
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
    if (String(error.message).toLowerCase().includes("profiles_display_name_unique_ci")) {
      return actionError(t(lang, "profile_action_input_invalid"), {
        displayName: t(lang, "profile_error_display_name_taken"),
      });
    }
    return actionError(t(lang, "auth_register_failed"));
  }

  // Falls Confirm-Mail aktiviert ist, gibt es noch keine Session -
  // dann läuft der Audit-Insert ohne actor_id leer (RLS) und wird geschluckt.
  // Sobald der User später bestätigt + sich einloggt, greift loginAction.
  await auditSafe("user.signup", { provider: "password" });

  // (auth) ist eine Route-Gruppe - URL ist /check-email, nicht /auth/check-email.
  redirect("/check-email");
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await auditSafe("user.logout");
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ── Google OAuth ───────────────────────────────────────────────────────────

export async function signInWithGoogleAction(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const env = clientEnv();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?provider=google`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data?.url) {
    redirect("/login?error=oauth_init_failed");
  }

  redirect(data.url);
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
  // redirectTo muss durch /auth/callback laufen, damit der Code via
  // exchangeCodeForSession() in eine Session getauscht wird.
  // Supabase hängt ?code=... an die redirectTo-URL an.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset/confirm`,
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

  await auditSafe("user.password_change");
  revalidatePath("/", "layout");
  return actionOk("Passwort aktualisiert. Du kannst dich jetzt einloggen.");
}

const updateProfileSchema = z.object({
  displayName: z
    .string({ message: "display_name" })
    .trim()
    .min(2, "display_name")
    .max(64, "display_name"),
  bio: z
    .string()
    .trim()
    .max(280, "bio")
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  avatarUrl: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      // Preferred format: storage path inside profile-avatars bucket.
      if (!v.startsWith("http://") && !v.startsWith("https://")) {
        if (v.includes("..") || !/^avatars\/[a-zA-Z0-9/_\-.]{1,240}$/.test(v)) {
          ctx.addIssue({ code: "custom", message: "avatar" });
          return z.NEVER;
        }
        return v;
      }
      try {
        const u = new URL(v);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          ctx.addIssue({ code: "custom", message: "avatar" });
          return z.NEVER;
        }
        return u.toString();
      } catch {
        ctx.addIssue({ code: "custom", message: "avatar" });
        return z.NEVER;
      }
    }),
});

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return actionError(t(lang, "profile_action_login_required"));

  const parsed = updateProfileSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field === "displayName") fields.displayName = t(lang, "profile_error_display_name");
      if (field === "bio") fields.bio = t(lang, "profile_error_bio");
      if (field === "avatarUrl") fields.avatarUrl = t(lang, "profile_error_avatar");
    }
    return actionError(t(lang, "profile_action_input_invalid"), fields);
  }

  const normalizedAlias = parsed.data.displayName.trim();
  const { data: aliasTaken } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", normalizedAlias)
    .neq("id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (aliasTaken) {
    return actionError(t(lang, "profile_action_input_invalid"), {
      displayName: t(lang, "profile_error_display_name_taken"),
    });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      bio: parsed.data.bio,
      avatar_url: parsed.data.avatarUrl,
    })
    .eq("id", userData.user.id);

  if (error) {
    if (String(error.message).toLowerCase().includes("profiles_display_name_unique_ci")) {
      return actionError(t(lang, "profile_action_input_invalid"), {
        displayName: t(lang, "profile_error_display_name_taken"),
      });
    }
    return actionError(t(lang, "profile_action_save_failed"));
  }

  await supabase.auth.updateUser({ data: { display_name: parsed.data.displayName } });
  await auditSafe("user.profile_update", {
    bio_set: parsed.data.bio !== null,
  });
  revalidatePath("/", "layout");
  revalidatePath("/profile");
  return actionOk(t(lang, "profile_action_saved"));
}

export async function requestCurrentUserPasswordResetAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.email) return actionError(t(lang, "profile_action_login_required"));

  const env = clientEnv();
  const { error } = await supabase.auth.resetPasswordForEmail(userData.user.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset/confirm`,
  });

  if (error) return actionError(t(lang, "security_password_reset_failed"));
  await auditSafe("user.password_change", { source: "security_center_reset_request" });
  return actionOk(t(lang, "security_password_reset_sent"));
}

async function ensureAal2IfMfaEnabled(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  lang: ReturnType<typeof parseLangCookie>,
): Promise<ActionState | null> {
  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  // If listFactors fails (e.g. MFA not enabled in Supabase project) → treat as no factors enrolled
  if (factorsError) return null;

  const hasAnyFactor =
    (factorsData?.all ?? []).length > 0 ||
    (factorsData?.totp ?? []).length > 0 ||
    (factorsData?.phone ?? []).length > 0;
  if (!hasAnyFactor) return null;

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return actionError(t(lang, "security_2fa_required"));
  if ((data?.currentLevel ?? "aal1") !== "aal2") {
    return actionError(t(lang, "security_2fa_required"));
  }
  return null;
}

const changeEmailSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .min(1)
    .max(254)
    .email(),
});

export async function changeEmailWith2faAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return actionError(t(lang, "profile_action_login_required"));

  const parsed = changeEmailSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    return actionError(t(lang, "security_change_email_invalid"), {
      newEmail: t(lang, "security_change_email_invalid"),
    });
  }

  const aalError = await ensureAal2IfMfaEnabled(supabase, lang);
  if (aalError) return aalError;

  const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail });
  if (error) return actionError(t(lang, "security_change_email_failed"));

  await auditSafe("user.email_change", { pending_email: parsed.data.newEmail });
  revalidatePath("/profile");
  return actionOk(t(lang, "security_change_email_success"));
}

const changePhoneSchema = z.object({
  newPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d+]/g, ""))
    .pipe(z.string().regex(/^\+?[1-9]\d{7,14}$/)),
});

export async function changePhoneWith2faAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return actionError(t(lang, "profile_action_login_required"));

  const parsed = changePhoneSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    return actionError(t(lang, "security_change_phone_invalid"), {
      newPhone: t(lang, "security_change_phone_invalid"),
    });
  }

  const aalError = await ensureAal2IfMfaEnabled(supabase, lang);
  if (aalError) return aalError;

  const { error } = await supabase.auth.updateUser({ phone: parsed.data.newPhone });
  if (error) return actionError(t(lang, "security_change_phone_failed"));

  await auditSafe("user.profile_update", { phone_changed: true });
  revalidatePath("/profile");
  return actionOk(t(lang, "security_change_phone_success"));
}

const changeAddressSchema = z.object({
  addressLine1: z.string().trim().min(3).max(120),
  addressLine2: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  postalCode: z.string().trim().min(3).max(20),
  city: z.string().trim().min(2).max(80),
  country: z.string().trim().length(2).toUpperCase(),
});

export async function changeAddressWith2faAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return actionError(t(lang, "profile_action_login_required"));

  const aalError = await ensureAal2IfMfaEnabled(supabase, lang);
  if (aalError) return aalError;

  const parsed = changeAddressSchema.safeParse(safeFormDataToObject(formData));
  if (!parsed.success) {
    return actionError(t(lang, "security_change_address_invalid"));
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      address_line1: parsed.data.addressLine1,
      address_line2: parsed.data.addressLine2,
      address_postal_code: parsed.data.postalCode,
      address_city: parsed.data.city,
      address_country: parsed.data.country,
    })
    .eq("id", userData.user.id);
  if (error) return actionError(t(lang, "security_change_address_failed"));

  await auditSafe("user.profile_update", { address_changed: true });
  revalidatePath("/profile");
  return actionOk(t(lang, "security_change_address_success"));
}
