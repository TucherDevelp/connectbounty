import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/legal-doc";
import { legalPageMetadata } from "@/lib/i18n-metadata";

export const revalidate = 3600; // ISR: re-render at most once per hour

export async function generateMetadata(): Promise<Metadata> {
  return legalPageMetadata("legal_privacy_title");
}

export default function PrivacyPage() {
  return <LegalDoc variant="privacy" />;
}
