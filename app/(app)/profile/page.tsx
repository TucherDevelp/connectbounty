import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";
import { SecurityActions } from "@/components/profile/security-actions";
import { MfaSetupCard } from "@/components/profile/mfa-setup-card";
import { MfaVerifyCard } from "@/components/profile/mfa-verify-card";
import { SensitiveChangeForms } from "@/components/profile/sensitive-change-forms";
import { getCurrentUser } from "@/lib/auth/roles";
import { ensureProfileForUser } from "@/lib/auth/ensure-profile";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t } from "@/lib/i18n";

export default async function ProfilePage() {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await ensureProfileForUser(user);
  const sb = await getSupabaseServerClient();

  let initialAvatarPreviewUrl = profile.avatar_url ?? "";
  if (profile.avatar_url && !profile.avatar_url.startsWith("http")) {
    // Bucket is public → getPublicUrl needs no auth and no RLS policy
    const { data: publicData } = sb.storage
      .from("profile-avatars")
      .getPublicUrl(profile.avatar_url);
    initialAvatarPreviewUrl = publicData.publicUrl;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
      {/* Page heading */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {t(lang, "profile_page_title")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t(lang, "profile_page_intro")}</p>
      </div>

      {/* Profile card */}
      <section className="rounded-[var(--radius-lg)] border border-border/60 bg-[var(--color-surface-1)] p-4 sm:p-6">
        <ProfileForm
          initialDisplayName={profile.display_name ?? ""}
          initialBio={profile.bio ?? ""}
          initialAvatarValue={profile.avatar_url ?? ""}
          initialAvatarPreviewUrl={initialAvatarPreviewUrl}
        />
      </section>

      {/* Password card */}
      <section className="mt-5 rounded-[var(--radius-lg)] border border-border/60 bg-[var(--color-surface-1)] p-4 sm:p-6">
        <h2 className="text-base font-semibold">{t(lang, "security_password_section_title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(lang, "security_password_section_desc")}</p>
        <div className="mt-4">
          <SecurityActions />
        </div>
      </section>

      {/* 2FA card */}
      <section className="mt-5 rounded-[var(--radius-lg)] border border-border/60 bg-[var(--color-surface-1)] p-4 sm:p-6">
        <h2 className="text-base font-semibold">{t(lang, "security_2fa_section_title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(lang, "security_2fa_section_desc")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MfaSetupCard />
          <MfaVerifyCard />
        </div>
      </section>

      {/* Sensitive changes card */}
      <section className="mt-5 rounded-[var(--radius-lg)] border border-border/60 bg-[var(--color-surface-1)] p-4 sm:p-6">
        <h2 className="text-base font-semibold">{t(lang, "security_sensitive_changes_title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(lang, "security_sensitive_changes_desc")}</p>
        <div className="mt-5">
          <SensitiveChangeForms
            initialEmail={user.email ?? ""}
            initialPhone={user.phone ?? ""}
            initialAddress={{
              line1: profile.address_line1 ?? "",
              line2: profile.address_line2 ?? "",
              postalCode: profile.address_postal_code ?? "",
              city: profile.address_city ?? "",
              country: profile.address_country ?? "",
            }}
          />
        </div>
      </section>
    </div>
  );
}
