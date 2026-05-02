"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { useLang } from "@/context/lang-context";
import { updateProfileAction, saveAvatarAction } from "@/lib/auth/actions";
import type { ActionState } from "@/lib/auth/action-result";
import { idleAction } from "@/lib/auth/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert } from "@/components/ui/form-error";

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(idleAction);

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [avatarValue, setAvatarValue] = useState(initialAvatarValue);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(initialAvatarPreviewUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const fe = state.status === "error" ? state.fieldErrors : undefined;

  // Sync server-provided preview URL (after navigating back to page)
  useEffect(() => {
    if (initialAvatarPreviewUrl && !initialAvatarPreviewUrl.startsWith("blob:")) {
      setAvatarPreviewUrl(initialAvatarPreviewUrl);
      setAvatarValue(initialAvatarValue);
    }
  }, [initialAvatarPreviewUrl, initialAvatarValue]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // ── Form submit: build FormData manually so React state is the source of truth
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const fd = new FormData();
    fd.set("displayName", displayName);
    fd.set("bio", bio ?? "");
    fd.set("avatarUrl", avatarValue ?? "");

    startTransition(async () => {
      const result = await updateProfileAction(state, fd);
      setState(result);
      if (result.status === "ok") {
        // Force a full server re-render so the header avatar + page data refresh
        router.refresh();
      }
    });
  };

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const uploadAvatar = async (file: File) => {
    const isHeicLike =
      file.type.includes("heic") ||
      file.type.includes("heif") ||
      /\.(heic|heif)$/i.test(file.name);
    if (!file.type.startsWith("image/") || isHeicLike) {
      setAvatarUploadError(t("profile_form_avatar_bad_type"));
      return;
    }
    setAvatarUploadError(null);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const preview = URL.createObjectURL(file);
    objectUrlRef.current = preview;
    setAvatarPreviewUrl(preview);
    setUploadingAvatar(true);

    try {
      const rawExt = file.name.split(".").pop()?.toLowerCase();
      const ext =
        rawExt && /^[a-z0-9]+$/.test(rawExt)
          ? rawExt
          : file.type.split("/")[1]?.replace("+xml", "") || "jpg";

      const path = `avatars/${crypto.randomUUID()}.${ext}`;

      // 1. Get signed upload URL
      const signRes = await fetch("/api/storage/sign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bucket: "profile-avatars", path }),
      });
      if (!signRes.ok) {
        const errBody = (await signRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errBody?.error ?? `sign-upload HTTP ${signRes.status}`);
      }
      const { signedUrl } = (await signRes.json()) as { signedUrl: string };

      // 2. Upload file to storage
      const upRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!upRes.ok) throw new Error(`storage PUT HTTP ${upRes.status}`);

      // 3. Persist avatar path to DB immediately (don't wait for "Save profile")
      const saveResult = await saveAvatarAction(path);
      if (!saveResult.ok) {
        throw new Error(saveResult.error ?? "saveAvatarAction failed");
      }

      // 4. Update local state so the main save includes the new path
      setAvatarValue(path);
    } catch (err) {
      console.error("[ProfileForm] avatar upload error:", err);
      setAvatarUploadError(
        err instanceof Error
          ? `${t("profile_action_save_failed")} (${err.message})`
          : t("profile_action_save_failed"),
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-5" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}
      {state.status === "ok" && <FormAlert variant="success">{state.message}</FormAlert>}

      {/* Avatar */}
      <div className="space-y-1.5">
        <Label>{t("profile_form_avatar")}</Label>
        {avatarUploadError && <FormAlert>{avatarUploadError}</FormAlert>}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <input
            id="profileAvatarFile"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAvatar(file);
            }}
            disabled={uploadingAvatar}
          />
          <label
            htmlFor="profileAvatarFile"
            className="cursor-pointer rounded-full focus-within:outline-none focus-within:ring-2 focus-within:ring-primary"
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
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary">
                <UserRound className="h-10 w-10" strokeWidth={1.75} aria-hidden />
              </div>
            )}
          </label>
          <div>
            <button
              type="button"
              onClick={() => document.getElementById("profileAvatarFile")?.click()}
              disabled={uploadingAvatar}
              className="text-sm font-medium text-primary underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
            >
              {uploadingAvatar ? t("profile_form_avatar_uploading") : t("profile_form_avatar_edit")}
            </button>
          </div>
        </div>
        <FieldError id="profile-avatar-error" message={fe?.avatarUrl} />
      </div>

      {/* Display name */}
      <div className="space-y-1.5">
        <Label htmlFor="displayName">{t("profile_form_display_name")}</Label>
        <Input
          id="displayName"
          name="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={64}
          required
          invalid={Boolean(fe?.displayName)}
          aria-describedby={fe?.displayName ? "profile-display-name-error" : undefined}
        />
        <FieldError id="profile-display-name-error" message={fe?.displayName} />
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <Label htmlFor="bio">{t("profile_form_bio")}</Label>
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          invalid={Boolean(fe?.bio)}
          aria-describedby={fe?.bio ? "profile-bio-error" : "profile-bio-help"}
        />
        <FieldError id="profile-bio-error" message={fe?.bio} />
        {!fe?.bio && (
          <p id="profile-bio-help" className="text-xs text-muted-foreground">
            {t("profile_form_bio_help")}
          </p>
        )}
      </div>

      <div className="pt-1">
        <Button type="submit" disabled={isPending || uploadingAvatar}>
          {isPending ? t("profile_form_saving") : t("profile_form_save")}
        </Button>
      </div>
    </form>
  );
}
