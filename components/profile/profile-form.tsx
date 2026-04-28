"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserRound } from "lucide-react";
import { useLang } from "@/context/lang-context";
import { clientEnv } from "@/lib/env";
import { updateProfileAction } from "@/lib/auth/actions";
import { idleAction } from "@/lib/auth/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert } from "@/components/ui/form-error";

function SaveButton() {
  const { pending } = useFormStatus();
  const { t } = useLang();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("profile_form_saving") : t("profile_form_save")}
    </Button>
  );
}

export function ProfileForm({
  initialDisplayName,
  initialBio,
  initialAvatarUrl,
}: {
  initialDisplayName: string;
  initialBio: string;
  initialAvatarUrl: string;
}) {
  const { t } = useLang();
  const [state, formAction] = useActionState(updateProfileAction, idleAction);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `avatars/${crypto.randomUUID()}.${ext}`;
      const res = await fetch("/api/storage/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bucket: "profile-avatars", path }),
      });
      if (!res.ok) throw new Error("sign failed");
      const data = (await res.json()) as { signedUrl: string };
      const up = await fetch(data.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!up.ok) throw new Error("upload failed");

      const env = clientEnv();
      setAvatarUrl(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-avatars/${path}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}
      {state.status === "ok" && <FormAlert variant="success">{state.message}</FormAlert>}

      <div className="space-y-1.5">
        <Label>{t("profile_form_avatar")}</Label>
        <div className="flex items-center gap-4">
          <input type="hidden" id="avatarUrl" name="avatarUrl" value={avatarUrl} />
          <input
            id="profileAvatarFile"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
            }}
            disabled={uploadingAvatar}
          />
          <label
            htmlFor="profileAvatarFile"
            className="cursor-pointer rounded-full focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--color-brand-400)]"
            aria-label={t("profile_form_avatar")}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={t("profile_form_avatar_preview_alt")} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-brand-400)]/15 text-[var(--color-brand-400)]">
                <UserRound className="h-10 w-10" strokeWidth={1.75} aria-hidden />
              </div>
            )}
          </label>
          <div className="flex-1">
            <button
              type="button"
              onClick={() => document.getElementById("profileAvatarFile")?.click()}
              className="text-sm font-medium text-[var(--color-brand-400)] underline underline-offset-4 hover:text-[var(--color-brand-300)]"
            >
              {t("profile_form_avatar_edit")}
            </button>
          </div>
        </div>
        <FieldError id="profile-avatar-error" message={fe?.avatarUrl} />
        {!fe?.avatarUrl && (
          <p id="profile-avatar-help" className="text-xs text-[var(--color-text-faint)]">
            {uploadingAvatar ? t("profile_form_avatar_uploading") : t("profile_form_avatar_help")}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="displayName">{t("profile_form_display_name")}</Label>
        <Input
          id="displayName"
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={64}
          required
          invalid={Boolean(fe?.displayName)}
          aria-describedby={fe?.displayName ? "profile-display-name-error" : undefined}
        />
        <FieldError id="profile-display-name-error" message={fe?.displayName} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">{t("profile_form_bio")}</Label>
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={280}
          invalid={Boolean(fe?.bio)}
          aria-describedby={fe?.bio ? "profile-bio-error" : "profile-bio-help"}
        />
        <FieldError id="profile-bio-error" message={fe?.bio} />
        {!fe?.bio && (
          <p id="profile-bio-help" className="text-xs text-[var(--color-text-faint)]">
            {t("profile_form_bio_help")}
          </p>
        )}
      </div>

      <div className="pt-2">
        <SaveButton />
      </div>
    </form>
  );
}
