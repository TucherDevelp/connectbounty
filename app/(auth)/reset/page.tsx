import type { Metadata } from "next";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { RequestResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_reset_title", description: "meta_reset_desc" });
}

export default function ResetPage() {
  return <RequestResetForm />;
}
