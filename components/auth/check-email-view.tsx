"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/context/lang-context";

export function CheckEmailView() {
  const { t } = useLang();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth_check_email_heading")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("auth_check_email_body")}</p>
        <p className="text-xs text-[var(--color-text-faint)]">
          {t("auth_check_email_resend")}{" "}
          <Link href="/register" className="text-primary hover:underline">
            {t("auth_check_email_register_again")}
          </Link>{" "}
          {t("auth_check_email_spam")}
        </p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          {t("auth_check_email_back")}
        </Link>
      </CardContent>
    </Card>
  );
}
