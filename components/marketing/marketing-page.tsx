"use client";

import { Fragment, type RefObject } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { useLang } from "@/context/lang-context";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

/** Schritt-Nummer als SVG: scharfe Kreise auf HiDPI / Dark Mode (kein CSS-Border-Blur). */
function HowStepBadge({ n }: { n: string }) {
  return (
    <svg
      width={44}
      height={44}
      viewBox="0 0 44 44"
      className="shrink-0 text-primary"
      shapeRendering="geometricPrecision"
      aria-hidden
    >
      <circle
        cx={22}
        cy={22}
        r={20}
        fill="hsl(var(--primary) / 0.14)"
        stroke="hsl(var(--primary) / 0.55)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={22}
        y={22}
        textAnchor="middle"
        dominantBaseline="central"
        fill="hsl(var(--primary))"
        className="font-display text-[13px] font-bold"
        style={{ fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif" }}
      >
        {n}
      </text>
    </svg>
  );
}

function MarketingNav() {
  const { t } = useLang();
  const { theme } = useTheme();
  const logoTone = theme === "dark" ? "light" : "default";

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label={t("nav_home")}>
          <Logo size="md" tone={logoTone} />
        </Link>
        <div className="hidden items-center gap-6 md:flex" aria-label={t("a11y_main_nav")}>
          <Link
            href="/login?redirect=/bounties"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav_browse")}
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("nav_login")}
          </Link>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <LangToggle />
          <ThemeToggle />
          <Link
            href="/register"
            className="ml-1 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-colors hover:opacity-90"
          >
            {t("marketing_nav_cta")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

function HowItWorksSection({ revealRef }: { revealRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useLang();
  const steps = [
    { title: t("how_step1_title"), desc: t("how_step1_desc"), n: "1" },
    { title: t("how_step2_title"), desc: t("how_step2_desc"), n: "2" },
    { title: t("how_step3_title"), desc: t("how_step3_desc"), n: "3" },
  ] as const;

  const d = (i: number) => ({ transitionDelay: `${0.06 + i * 0.085}s` as const });

  return (
    <div ref={revealRef} className="reveal reveal-how mx-auto max-w-6xl px-4">
      <h2
        className="how-animate-in font-display text-2xl font-bold sm:text-3xl"
        style={d(0)}
      >
        {t("how_title")}
      </h2>

      <div className="mt-10 hidden md:block">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-x-2 sm:gap-x-5">
          {steps.map((step, i) => (
            <Fragment key={`d-top-${step.n}`}>
              <div
                className="flex justify-center how-animate-in how-fade-only"
                style={d(1 + i * 2)}
              >
                <HowStepBadge n={step.n} />
              </div>
              {i < steps.length - 1 && (
                <div
                  className="flex justify-center px-1 text-primary/85 how-animate-in how-fade-only"
                  style={d(2 + i * 2)}
                  aria-hidden
                >
                  <ChevronRight className="size-6 shrink-0 how-arrow-dynamic-h" strokeWidth={2.25} />
                </div>
              )}
            </Fragment>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={`d-copy-${step.n}`} className="how-animate-in text-left" style={d(6 + i)}>
              <h3 className="font-display text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <ol className="mt-10 list-none space-y-0 p-0 md:hidden">
        {steps.map((step, i) => (
          <Fragment key={`m-${step.n}`}>
            <li className="flex gap-4">
              <div className="how-animate-in how-fade-only shrink-0" style={d(1 + i * 3)}>
                <HowStepBadge n={step.n} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5 how-animate-in" style={d(1 + i * 3)}>
                <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            </li>
            {i < steps.length - 1 && (
              <li
                className="flex justify-center py-4 text-primary/85 how-animate-in how-fade-only"
                style={d(2 + i * 3)}
                aria-hidden
              >
                <ChevronDown className="size-7 shrink-0 how-arrow-dynamic-v" strokeWidth={2.25} />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}

/** Qualitative Wertekarten - keine KPI-Zahlen (Plattform noch im Aufbau). */
function ValuesSection() {
  const { t } = useLang();

  const cards = [
    { titleKey: "mkt_value_1_title" as const, descKey: "mkt_value_1_desc" as const },
    { titleKey: "mkt_value_2_title" as const, descKey: "mkt_value_2_desc" as const },
    { titleKey: "mkt_value_3_title" as const, descKey: "mkt_value_3_desc" as const },
    { titleKey: "mkt_value_4_title" as const, descKey: "mkt_value_4_desc" as const },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("mkt_values_title")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("mkt_values_intro")}</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.titleKey}
            className="card-fintech rounded-xl border border-border/50 bg-surface/50 p-6"
          >
            <p className="font-display text-lg font-semibold text-foreground">{t(c.titleKey)}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(c.descKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketingFooter() {
  const { t } = useLang();
  const { theme } = useTheme();
  const logoTone = theme === "dark" ? "light" : "default";

  return (
    <footer className="border-t border-border/40 bg-surface py-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-3">
        <div>
          <Logo size="md" tone={logoTone} />
          <p className="mt-4 text-sm text-muted-foreground">{t("footer_tagline")}</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-semibold text-foreground">{t("footer_legal_heading")}</span>
          <Link href="/legal/impressum" className="text-muted-foreground hover:text-foreground">
            {t("footer_legal")}
          </Link>
          <Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground">
            {t("footer_privacy")}
          </Link>
          <Link href="/legal/terms" className="text-muted-foreground hover:text-foreground">
            {t("footer_terms")}
          </Link>
        </div>
        <div className="flex flex-col justify-end gap-4 md:items-end">
          <div className="flex gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav_login")}
            </Link>
            <Link href="/register" className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav_register")}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {t("footer_copy")}
          </p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingPage() {
  const { t } = useLang();
  const revealFeatures = useReveal(0.12);
  const revealHow = useReveal(0.12);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MarketingNav />

      <header className="relative overflow-hidden hero-bg">
        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:pt-24">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary shimmer-badge">
            <Sparkles className="size-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
            {t("hero_badge")}
          </p>
          <h1 className="max-w-4xl font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t("hero_title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{t("hero_subtitle")}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
            >
              {t("hero_cta_primary")}
            </Link>
            <Link
              href="/login?redirect=/bounties"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface/60 px-6 text-sm font-semibold text-foreground backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-surface-2"
            >
              {t("hero_cta_secondary")}
            </Link>
          </div>
          <div className="mt-20 flex justify-center">
            <a
              href="#values"
              className="scroll-indicator text-muted-foreground"
              aria-label={t("a11y_scroll_down")}
            >
              <ChevronDown size={28} />
            </a>
          </div>
        </div>
      </header>

      <div id="values">
        <ValuesSection />
      </div>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("feat_title")}</h2>
        <div
          ref={revealFeatures}
          className="reveal mt-10 grid gap-4 lg:grid-cols-3 lg:grid-rows-2"
        >
          <div className="card-fintech flex flex-col gap-3 rounded-xl border border-border/50 bg-surface/40 p-6 lg:col-span-2 lg:row-span-2 lg:min-h-[280px] lg:justify-center">
            <Zap className="text-primary" size={24} strokeWidth={1.75} aria-hidden />
            <h3 className="font-display text-xl font-semibold">{t("feat_post_title")}</h3>
            <p className="max-w-xl text-sm text-muted-foreground">{t("feat_post_desc")}</p>
          </div>
          <div className="card-fintech flex flex-col gap-3 rounded-xl border border-border/50 bg-surface/40 p-6">
            <MessageCircle className="text-muted-foreground" size={20} strokeWidth={1.75} aria-hidden />
            <h3 className="font-display text-lg font-semibold">{t("feat_chat_title")}</h3>
            <p className="text-sm text-muted-foreground">{t("feat_chat_desc")}</p>
          </div>
          <div className="card-fintech flex flex-col gap-3 rounded-xl border border-border/50 bg-surface/40 p-6">
            <TrendingUp className="text-muted-foreground" size={20} strokeWidth={1.75} aria-hidden />
            <h3 className="font-display text-lg font-semibold">{t("feat_payout_title")}</h3>
            <p className="text-sm text-muted-foreground">{t("feat_payout_desc")}</p>
          </div>
          <div className="card-fintech flex flex-col gap-3 rounded-xl border border-border/50 bg-surface/40 p-6 lg:col-span-3">
            <ShieldCheck className="text-muted-foreground" size={20} strokeWidth={1.75} aria-hidden />
            <h3 className="font-display text-lg font-semibold">{t("feat_kyc_title")}</h3>
            <p className="text-sm text-muted-foreground">{t("feat_kyc_desc")}</p>
          </div>
        </div>
      </section>

      <section className="border-y border-border/40 bg-surface/30 py-16">
        <HowItWorksSection revealRef={revealHow} />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          {[t("trust_soc2"), t("trust_gdpr"), t("trust_stripe"), t("trust_kyc")].map((label) => (
            <span
              key={label}
              className="rounded-full border border-border/60 bg-surface/50 px-4 py-2 text-xs font-medium text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
