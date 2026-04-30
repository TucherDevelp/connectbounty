import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email ?? "";
  const displayName =
    profile?.display_name ??
    (user.user_metadata?.display_name as string | undefined) ??
    email.split("@")[0] ??
    "";

  // Build public avatar URL (bucket is public=true, no auth needed)
  let avatarPublicUrl = "";
  if (profile?.avatar_url) {
    if (profile.avatar_url.startsWith("http")) {
      avatarPublicUrl = profile.avatar_url;
    } else {
      const { data: pubData } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(profile.avatar_url);
      avatarPublicUrl = pubData.publicUrl;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader email={email} displayName={displayName} avatarUrl={avatarPublicUrl} />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
