"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signInWithGoogleAction } from "@/lib/auth/actions";
import { useLang } from "@/context/lang-context";

/**
 * Google-OAuth-Button ohne verschachteltes <form>-Element.
 */
export function GoogleButton({ label }: { label: string }) {
  const [isPending, startTransition] = useTransition();
  const { t } = useLang();

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      disabled={isPending}
      className="w-full min-h-11"
      onClick={() => startTransition(() => void signInWithGoogleAction())}
    >
      <GoogleIcon className="h-5 w-5 shrink-0" aria-hidden />
      {isPending ? t("auth_oauth_pending") : label}
    </Button>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.89-1.741 2.982-4.305 2.982-7.351z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.232-2.51c-.896.6-2.041.955-3.386.955-2.604 0-4.81-1.76-5.597-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.403 13.9A6.005 6.005 0 0 1 6.09 12c0-.66.114-1.3.314-1.9V7.51H3.064A9.997 9.997 0 0 0 2 12c0 1.614.387 3.14 1.064 4.49l3.34-2.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.99 14.696 2 12 2A9.997 9.997 0 0 0 3.064 7.51l3.34 2.59C7.19 7.737 9.396 5.977 12 5.977z"
        fill="#EA4335"
      />
    </svg>
  );
}
