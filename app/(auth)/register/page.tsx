import type { Metadata } from "next";
import { localizedMetadata } from "@/lib/i18n-metadata";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({
    title: "meta_register_title",
    description: "meta_register_desc",
  });
}

export default function RegisterPage() {
  return <RegisterForm />;
}
