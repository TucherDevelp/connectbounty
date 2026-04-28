import { cookies } from "next/headers";
import { SecurityActions } from "@/components/profile/security-actions";
import { MfaSetupCard } from "@/components/profile/mfa-setup-card";
import { MfaVerifyCard } from "@/components/profile/mfa-verify-card";
import { SensitiveChangeForms } from "@/components/profile/sensitive-change-forms";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import { t } from "@/lib/i18n";

export default async function SecuritySettingsPage() {
  const lang = parseLangCookie((await cookies()).get(LANG_COOKIE)?.value);

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t(lang, "security_page_title")}</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t(lang, "security_page_intro")}</p>

      <div className="mt-6 space-y-5">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
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

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t(lang, "security_2fa_section_title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t(lang, "security_2fa_section_desc")}
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-muted)]">
            <li>{t(lang, "security_2fa_item_email")}</li>
            <li>{t(lang, "security_2fa_item_phone")}</li>
            <li>{t(lang, "security_2fa_item_address")}</li>
          </ul>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MfaSetupCard />
            <MfaVerifyCard />
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-5">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t(lang, "security_sensitive_changes_title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t(lang, "security_sensitive_changes_desc")}
          </p>
          <div className="mt-4">
            <SensitiveChangeForms
              initialEmail=""
              initialPhone=""
              initialAddress={{ line1: "", line2: "", postalCode: "", city: "", country: "" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
