"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserRound } from "lucide-react";
import { useLang } from "@/context/lang-context";
import { updateProfileAction, saveAvatarAction } from "@/lib/auth/actions";
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
  initialAvatarValue,
  initialAvatarPreviewUrl,
}: {
  initialDisplayName: string;
  initialBio: string;
  initialAvatarValue: string;
  initialAvatarPreviewUrl: string;
}) {
  const { t } = useLang();
  const [state, formAction] = useActionState(updateProfileAction, idleAction);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [avatarValue, setAvatarValue] = useState(initialAvatarValue);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(initialAvatarPreviewUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const objectUrlRevokeRef = useRef<string | null>(null);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  // Sync preview when the server re-renders with a new public URL after save.
  // Only update when the incoming URL is a real https URL (not empty, not a blob:).
  // This avoids overwriting the immediate local object-URL preview while uploading.
  useEffect(() => {
    if (initialAvatarPreviewUrl && !initialAvatarPreviewUrl.startsWith("blob:")) {
      setAvatarPreviewUrl(initialAvatarPreviewUrl);
      setAvatarValue(initialAvatarValue);
    }
  }, [initialAvatarPreviewUrl, initialAvatarValue]);

  useEffect(() => {
    return () => {
      if (objectUrlRevokeRef.current) {
        URL.revokeObjectURL(objectUrlRevokeRef.current);
      }
    };
  }, []);

  const revokePreviousObjectUrl = () => {
    if (objectUrlRevokeRef.current) {
      URL.revokeObjectURL(objectUrlRevokeRef.current);
      objectUrlRevokeRef.current = null;
    }
  };

  const uploadAvatar = async (file: File) => {
    // HEIC/iPhone: Browser report often image/heic oder leer → <img> zeigt dann nichts
    const isHeicLike =
      file.type.includes("heic") ||
      file.type.includes("heif") ||
      /\.(heic|heif)$/i.test(file.name);
    if (!file.type.startsWith("image/") || isHeicLike) {
      setAvatarUploadError(t("profile_form_avatar_bad_type"));
      return;
    }
    setAvatarUploadError(null);

    revokePreviousObjectUrl();
    const preview = URL.createObjectURL(file);
    objectUrlRevokeRef.current = preview;
    setAvatarPreviewUrl(preview);

    setUploadingAvatar(true);
    try {
      const rawExt = file.name.split(".").pop()?.toLowerCase();
      const ext =
        rawExt && /^[a-z0-9]+$/.test(rawExt)
          ? rawExt
          : file.type.split("/")[1]?.replace("+xml", "") || "jpg";

      const path = `avatars/${crypto.randomUUID()}.${ext}`;
      const res = await fetch("/api/storage/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bucket: "profile-avatars", path }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errBody?.error ?? "sign failed");
      }
      const data = (await res.json()) as { signedUrl: string };
      const up = await fetch(data.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!up.ok) throw new Error("upload failed");

      // Persist path to DB immediately — user doesn't need to click "Save"
      const saveResult = await saveAvatarAction(path);
      if (!saveResult.ok) {
        throw new Error(saveResult.error ?? "save failed");
      }
      setAvatarValue(path);
    } catch (err) {
      console.error("[profile-form] avatar upload failed:", err);
      setAvatarUploadError(
        err instanceof Error
          ? `${t("profile_action_save_failed")} (${err.message})`
          : t("profile_action_save_failed"),
      );
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
        {avatarUploadError && <FormAlert>{avatarUploadError}</FormAlert>}
        <div className="flex items-center gap-4">
          <input type="hidden" id="avatarUrl" name="avatarUrl" value={avatarValue} />
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
            {avatarPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreviewUrl}
                alt={t("profile_form_avatar_preview_alt")}
                className="h-20 w-20 rounded-full object-cover"
              />
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
