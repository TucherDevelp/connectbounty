import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/legal-doc";
import { legalPageMetadata } from "@/lib/i18n-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return legalPageMetadata("legal_impressum_title");
}

export default function ImpressumPage() {
  return <LegalDoc variant="impressum" />;
}
