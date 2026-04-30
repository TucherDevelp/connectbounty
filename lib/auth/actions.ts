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

  const serviceSb = getSupabaseServiceRoleClient();
  const userId = userData.user.id;

  // ── Step 1: load current row (service role → bypasses all RLS) ────────────
  const { data: existingRow, error: selectErr } = await serviceSb
    .from("profiles")
    .select("id, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (selectErr) {
    console.error("[updateProfileAction] select error:", selectErr.message);
    return actionError(`${t(lang, "profile_action_save_failed")} (select: ${selectErr.message})`);
  }

  // Never overwrite a stored avatar with null when the form didn't touch it.
  const resolvedAvatarUrl = parsed.data.avatarUrl ?? existingRow?.avatar_url ?? null;
  const newBio = parsed.data.bio ?? null;

  console.log("[updateProfileAction] writing to DB:", {
    userId,
    display_name: parsed.data.displayName,
    bio: newBio,
    avatar_url: resolvedAvatarUrl,
    rowExists: !!existingRow,
  });

  // ── Step 2: UPDATE or INSERT ───────────────────────────────────────────────
  if (existingRow) {
    const { data: updated, error: updateErr } = await serviceSb
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        bio: newBio,
        avatar_url: resolvedAvatarUrl,
      })
      .eq("id", userId)
      .select("id, display_name, bio, avatar_url")
      .maybeSingle();

    if (updateErr) {
      console.error("[updateProfileAction] update error:", updateErr.message);
      if (updateErr.message.toLowerCase().includes("profiles_display_name_unique_ci")) {
        return actionError(t(lang, "profile_action_input_invalid"), {
          displayName: t(lang, "profile_error_display_name_taken"),
        });
      }
      return actionError(`${t(lang, "profile_action_save_failed")} (${updateErr.message})`);
    }
    console.log("[updateProfileAction] UPDATE confirmed:", updated);
  } else {
    // Profile row missing — create it (handle_new_user trigger did not run)
    const { data: inserted, error: insertErr } = await serviceSb
      .from("profiles")
      .insert({
        id: userId,
        display_name: parsed.data.displayName,
        bio: newBio,
        avatar_url: resolvedAvatarUrl,
      })
      .select("id, display_name, bio, avatar_url")
      .maybeSingle();

    if (insertErr) {
      console.error("[updateProfileAction] insert error:", insertErr.message);
      if (insertErr.message.toLowerCase().includes("profiles_display_name_unique_ci")) {
        return actionError(t(lang, "profile_action_input_invalid"), {
          displayName: t(lang, "profile_error_display_name_taken"),
        });
      }
      return actionError(`${t(lang, "profile_action_save_failed")} (${insertErr.message})`);
    }
    console.log("[updateProfileAction] INSERT confirmed:", inserted);
  }

  await supabase.auth.updateUser({ data: { display_name: parsed.data.displayName } });
  await auditSafe("user.profile_update", {
    bio_set: parsed.data.bio !== null,
  });
  revalidatePath("/", "layout");
  revalidatePath("/profile");
  return actionOk(t(lang, "profile_action_saved"));
}

/**
 * Saves only the avatar_url immediately after the file is uploaded to storage.
 * Called automatically from the profile form after a successful upload so the
 * user does not have to click "Save profile" to persist the new picture.
 *
 * Returns { ok: boolean, error?: string } so the client can surface failures.
 */
export async function saveAvatarAction(
  avatarPath: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "not_authenticated" };

  // Same validation as updateProfileSchema
  if (
    !avatarPath ||
    avatarPath.includes("..") ||
    !/^avatars\/[a-zA-Z0-9/_\-.]{1,240}$/.test(avatarPath)
  ) {
    console.error("[saveAvatarAction] invalid path rejected:", avatarPath);
    return { ok: false, error: "invalid_path" };
  }

  // Use service role to bypass RLS (RLS forbids client INSERT on profiles).
  const serviceSb = getSupabaseServiceRoleClient();

  // Step 1: check if profile row exists
  const { data: existing } = await serviceSb
    .from("profiles")
    .select("id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (existing) {
    // Update only avatar_url, preserve everything else
    const { data: updated, error } = await serviceSb
      .from("profiles")
      .update({ avatar_url: avatarPath })
      .eq("id", userData.user.id)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[saveAvatarAction] update error:", error.message);
      return { ok: false, error: error.message };
    }
    if (!updated) {
      return { ok: false, error: "no_row_written" };
    }
  } else {
    // Insert new profile row with sensible defaults
    const fallbackName =
      (userData.user.user_metadata?.display_name as string | undefined) ??
      userData.user.email?.split("@")[0] ??
      "Neuer Nutzer";
    const { error } = await serviceSb.from("profiles").insert({
      id: userData.user.id,
      display_name: fallbackName,
      avatar_url: avatarPath,
    });
    if (error) {
      console.error("[saveAvatarAction] insert error:", error.message);
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  return { ok: true };
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
  if (factorsError) {
    console.error("[ensureAal2IfMfaEnabled] listFactors error:", factorsError.message);
    return null;
  }

  const hasAnyFactor =
    (factorsData?.all ?? []).length > 0 ||
    (factorsData?.totp ?? []).length > 0 ||
    (factorsData?.phone ?? []).length > 0;
  if (!hasAnyFactor) return null;

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    console.error("[ensureAal2IfMfaEnabled] getAuthenticatorAssuranceLevel error:", error.message);
    return actionError(t(lang, "security_2fa_required"));
  }
  if ((data?.currentLevel ?? "aal1") !== "aal2") {
    console.error("[ensureAal2IfMfaEnabled] currentLevel is not aal2:", data?.currentLevel, "nextLevel:", data?.nextLevel);
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
  if (error) {
    console.error("[changeEmailWith2faAction] updateUser error:", error.message, error.status);
    return actionError(`${t(lang, "security_change_email_failed")} (${error.message})`);
  }

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
  if (error) {
    console.error("[changePhoneWith2faAction] updateUser error:", error.message, error.status);
    return actionError(`${t(lang, "security_change_phone_failed")} (${error.message})`);
  }

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

  // Use service role so the UPDATE always goes through regardless of RLS.
  // The user's identity is already verified above via getUser().
  const serviceSbAddr = getSupabaseServiceRoleClient();
  const { data: updatedAddr, error } = await serviceSbAddr
    .from("profiles")
    .update({
      address_line1: parsed.data.addressLine1,
      address_line2: parsed.data.addressLine2 ?? null,
      address_postal_code: parsed.data.postalCode,
      address_city: parsed.data.city,
      address_country: parsed.data.country,
    })
    .eq("id", userData.user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[changeAddressWith2faAction] update error:", error.message);
    if (/column .*address.* does not exist/i.test(error.message)) {
      return actionError(
        "Die Adressspalten existieren noch nicht in der Datenbank. " +
          "Bitte führe die SQL-Datei supabase/migrations/0008_profile_security_fields.sql " +
          "im Supabase Dashboard SQL-Editor aus.",
      );
    }
    return actionError(t(lang, "security_change_address_failed"));
  }
  if (!updatedAddr) {
    // Row missing — auto-create it first, then retry
    console.warn("[changeAddressWith2faAction] no profile row found, creating one first");
    const fallbackName =
      (userData.user.user_metadata?.display_name as string | undefined)?.trim() ||
      userData.user.email?.split("@")[0] || "Neuer Nutzer";
    await serviceSbAddr.from("profiles").insert({
      id: userData.user.id,
      display_name: fallbackName,
      address_line1: parsed.data.addressLine1,
      address_line2: parsed.data.addressLine2 ?? null,
      address_postal_code: parsed.data.postalCode,
      address_city: parsed.data.city,
      address_country: parsed.data.country,
    });
  }

  console.log("[changeAddressWith2faAction] address saved for user:", userData.user.id);
  await auditSafe("user.profile_update", { address_changed: true });
  revalidatePath("/profile");
  return actionOk(t(lang, "security_change_address_success"));
}
