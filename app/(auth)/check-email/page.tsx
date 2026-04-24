import type { Metadata } from "next";
import { CheckEmailView } from "@/components/auth/check-email-view";
import { localizedMetadata } from "@/lib/i18n-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_check_email_title" });
}

export default function CheckEmailPage() {
  return <CheckEmailView />;
}
