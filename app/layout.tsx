import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, Inter_Tight } from "next/font/google";
import { AppProviders } from "@/components/providers";
import { LANG_COOKIE, parseLangCookie } from "@/lib/lang-cookie";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "ConnectBounty",
    template: "%s | ConnectBounty",
  },
  description:
    "ConnectBounty - Plattform für Job-Referral-Boni: sichere Vermittlung, transparente Provisionen, geprüfte Profile.",
  applicationName: "ConnectBounty",
  icons: {
    icon: "/assets/bonbon-logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  width: "device-width",
  initialScale: 1,
};

const themeInitScript = `(function(){try{var d=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',d);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialLang = parseLangCookie(cookieStore.get(LANG_COOKIE)?.value);

  return (
    <html
      lang={initialLang}
      className={`${inter.variable} ${interTight.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AppProviders initialLang={initialLang}>{children}</AppProviders>
      </body>
    </html>
  );
}
