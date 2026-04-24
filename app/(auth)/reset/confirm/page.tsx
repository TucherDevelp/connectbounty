import type { Metadata } from "next";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { ConfirmResetForm } from "./confirm-form";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: "meta_reset_confirm_title" });
}

export default function ConfirmResetPage() {
  return <ConfirmResetForm />;
}
