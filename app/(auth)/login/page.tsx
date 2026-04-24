import type { Metadata } from "next";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_login_title", description: "meta_login_desc" });
}

export default function LoginPage() {
  return <LoginForm />;
}
