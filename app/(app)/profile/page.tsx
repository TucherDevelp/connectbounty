import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";
import { SecurityActions } from "@/components/profile/security-actions";
import { MfaSetupCard } from "@/components/profile/mfa-setup-card";
import { MfaVerifyCard } from "@/components/profile/mfa-verify-card";
import { SensitiveChangeForms } from "@/components/profile/sensitive-change-forms";
import { getCurrentUser } from "@/lib/auth/roles";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t } from "@/lib/i18n";

export default async function ProfilePage() {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const user = await getCurrentUser();
  const sb = await getSupabaseServerClient();
  const { data: profile } = user
    ? await sb
        .from("profiles")
        .select("display_name, bio, avatar_url, address_line1, address_line2, address_postal_code, address_city, address_country")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  let initialAvatarPreviewUrl = profile?.avatar_url ?? "";
  if (profile?.avatar_url && !profile.avatar_url.startsWith("http")) {
    // Bucket is public → getPublicUrl needs no auth and no RLS policy
    const { data: publicData } = sb.storage
      .from("profile-avatars")
      .getPublicUrl(profile.avatar_url);
    initialAvatarPreviewUrl = publicData.publicUrl;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t(lang, "profile_page_title")}</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t(lang, "profile_page_intro")}</p>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
        <ProfileForm
          initialDisplayName={profile?.display_name ?? ""}
          initialBio={profile?.bio ?? ""}
          initialAvatarValue={profile?.avatar_url ?? ""}
          initialAvatarPreviewUrl={initialAvatarPreviewUrl}
        />
      </div>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {t(lang, "security_password_section_title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {t(lang, "security_password_section_desc")}
        </p>
        <div className="mt-4">
          <SecurityActions />
        </div>
      </div>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {t(lang, "security_2fa_section_title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {t(lang, "security_2fa_section_desc")}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MfaSetupCard />
          <MfaVerifyCard />
        </div>
      </div>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {t(lang, "security_sensitive_changes_title")}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {t(lang, "security_sensitive_changes_desc")}
        </p>
        <div className="mt-4">
          <SensitiveChangeForms
            initialEmail={user?.email ?? ""}
            initialPhone={user?.phone ?? ""}
            initialAddress={{
              line1: profile?.address_line1 ?? "",
              line2: profile?.address_line2 ?? "",
              postalCode: profile?.address_postal_code ?? "",
              city: profile?.address_city ?? "",
              country: profile?.address_country ?? "",
            }}
          />
        </div>
      </div>
    </section>
  );
}
