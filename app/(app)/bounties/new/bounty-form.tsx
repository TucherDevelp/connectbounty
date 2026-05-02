"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useLang } from "@/context/lang-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert } from "@/components/ui/form-error";
import { createBountyAction } from "@/lib/bounty/actions";
import { idleAction } from "@/lib/auth/action-result";
import {
  INSERENT_BPS,
  CANDIDATE_BPS,
  PLATFORM_NO_REFERRER_BPS,
} from "@/lib/stripe/split-constants";

const DEFAULT_SPLIT = {
  inserentBps: INSERENT_BPS,
  candidateBps: CANDIDATE_BPS,
  platformBps: PLATFORM_NO_REFERRER_BPS,
} as const;

const BOUNTY_DRAFT_KEY = "bounty-new:draft-v1";
const OPENED_PAYMENT_KEY = "bounty-new:opened-payment-terms";
const OPENED_AGB_KEY = "bounty-new:opened-agb";
const READ_PAYMENT_KEY = "bounty-new:read-payment-terms";
const READ_AGB_KEY = "bounty-new:read-agb";

function parseBonusAmount(input: string): number {
  const normalized = input.trim().replace(",", ".");
  if (normalized === "") return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatSplitAmount(amount: number, currencyInput: string, locale: string): string {
  const currency = currencyInput.trim().toUpperCase();
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : "EUR";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: safeCurrency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${safeCurrency}`;
  }
}

function SubmitButton({ saving, label }: { saving: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? saving : label}
    </Button>
  );
}

export function BountyForm() {
  const { t, lang } = useLang();
  const [state, formAction] = useActionState(createBountyAction, idleAction);
  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [bonusAmountInput, setBonusAmountInput] = useState("");
  const [bonusCurrencyInput, setBonusCurrencyInput] = useState("EUR");
  const [locationInput, setLocationInput] = useState("");
  const [industryInput, setIndustryInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [paymentTermsUnlocked, setPaymentTermsUnlocked] = useState(false);
  const [agbUnlocked, setAgbUnlocked] = useState(false);
  const [acceptPaymentTermsChecked, setAcceptPaymentTermsChecked] = useState(false);
  const [acceptAgbTermsChecked, setAcceptAgbTermsChecked] = useState(false);
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const splitPreview = useMemo(() => {
    const bonusAmount = parseBonusAmount(bonusAmountInput);
    const referrerAmount = (bonusAmount * DEFAULT_SPLIT.inserentBps) / 10_000;
    const candidateAmount = (bonusAmount * DEFAULT_SPLIT.candidateBps) / 10_000;
    const platformAmount = (bonusAmount * DEFAULT_SPLIT.platformBps) / 10_000;

    return {
      referrer: formatSplitAmount(referrerAmount, bonusCurrencyInput, lang === "de" ? "de-DE" : "en-US"),
      candidate: formatSplitAmount(candidateAmount, bonusCurrencyInput, lang === "de" ? "de-DE" : "en-US"),
      platform: formatSplitAmount(platformAmount, bonusCurrencyInput, lang === "de" ? "de-DE" : "en-US"),
    };
  }, [bonusAmountInput, bonusCurrencyInput, lang]);

  useEffect(() => {
    try {
      const rawDraft = sessionStorage.getItem(BOUNTY_DRAFT_KEY);
      if (rawDraft) {
        const draft = JSON.parse(rawDraft) as {
          title?: string;
          description?: string;
          bonusAmount?: string;
          bonusCurrency?: string;
          location?: string;
          industry?: string;
          tags?: string;
          expiresAt?: string;
          acceptPaymentTerms?: boolean;
          acceptAgbTerms?: boolean;
        };
        setTitleInput(draft.title ?? "");
        setDescriptionInput(draft.description ?? "");
        setBonusAmountInput(draft.bonusAmount ?? "");
        setBonusCurrencyInput(draft.bonusCurrency ?? "EUR");
        setLocationInput(draft.location ?? "");
        setIndustryInput(draft.industry ?? "");
        setTagsInput(draft.tags ?? "");
        setExpiresAtInput(draft.expiresAt ?? "");
        setAcceptPaymentTermsChecked(Boolean(draft.acceptPaymentTerms));
        setAcceptAgbTermsChecked(Boolean(draft.acceptAgbTerms));
      }

      const openedPayment = sessionStorage.getItem(OPENED_PAYMENT_KEY) === "true";
      const openedAgb = sessionStorage.getItem(OPENED_AGB_KEY) === "true";
      const readPayment = sessionStorage.getItem(READ_PAYMENT_KEY) === "true";
      const readAgb = sessionStorage.getItem(READ_AGB_KEY) === "true";
      setPaymentTermsUnlocked(openedPayment && readPayment);
      setAgbUnlocked(openedAgb && readAgb);
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        BOUNTY_DRAFT_KEY,
        JSON.stringify({
          title: titleInput,
          description: descriptionInput,
          bonusAmount: bonusAmountInput,
          bonusCurrency: bonusCurrencyInput,
          location: locationInput,
          industry: industryInput,
          tags: tagsInput,
          expiresAt: expiresAtInput,
          acceptPaymentTerms: acceptPaymentTermsChecked,
          acceptAgbTerms: acceptAgbTermsChecked,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [
    titleInput,
    descriptionInput,
    bonusAmountInput,
    bonusCurrencyInput,
    locationInput,
    industryInput,
    tagsInput,
    expiresAtInput,
    acceptPaymentTermsChecked,
    acceptAgbTermsChecked,
  ]);

  const handleOpenPaymentTerms = () => {
    try {
      sessionStorage.setItem(OPENED_PAYMENT_KEY, "true");
    } catch {
      // ignore storage errors
    }
  };

  const handleOpenAgb = () => {
    try {
      sessionStorage.setItem(OPENED_AGB_KEY, "true");
    } catch {
      // ignore storage errors
    }
  };

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && !fe && <FormAlert>{state.message}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{t("bounty_form_title_label")}</Label>
        <Input
          id="title"
          name="title"
          placeholder={t("bounty_form_title_ph")}
          required
          maxLength={120}
          value={titleInput}
          onChange={(event) => setTitleInput(event.target.value)}
          invalid={Boolean(fe?.title)}
          aria-describedby={fe?.title ? "title-error" : "title-help"}
        />
        <FieldError id="title-error" message={fe?.title} />
        {!fe?.title && (
          <p id="title-help" className="text-xs text-[var(--color-text-faint)]">
            {t("bounty_form_title_help")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">{t("bounty_form_desc_label")}</Label>
        <Textarea
          id="description"
          name="description"
          placeholder={t("bounty_form_desc_ph")}
          required
          minLength={20}
          maxLength={5000}
          rows={10}
          value={descriptionInput}
          onChange={(event) => setDescriptionInput(event.target.value)}
          invalid={Boolean(fe?.description)}
          aria-describedby={fe?.description ? "description-error" : "description-help"}
        />
        <FieldError id="description-error" message={fe?.description} />
        {!fe?.description && (
          <p id="description-help" className="text-xs text-[var(--color-text-faint)]">
            {t("bounty_form_desc_help")}
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bonusAmount">{t("bounty_form_bonus_label")}</Label>
          <Input
            id="bonusAmount"
            name="bonusAmount"
            type="text"
            inputMode="decimal"
            placeholder="1500"
            required
            invalid={Boolean(fe?.bonusAmount)}
            aria-describedby={fe?.bonusAmount ? "bonus-error" : undefined}
            value={bonusAmountInput}
            onChange={(event) => setBonusAmountInput(event.target.value)}
          />
          <FieldError id="bonus-error" message={fe?.bonusAmount} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bonusCurrency">{t("bounty_form_currency_label")}</Label>
          <Input
            id="bonusCurrency"
            name="bonusCurrency"
            type="text"
            value={bonusCurrencyInput}
            onChange={(event) => setBonusCurrencyInput(event.target.value)}
            maxLength={3}
            required
            invalid={Boolean(fe?.bonusCurrency)}
            aria-describedby={fe?.bonusCurrency ? "currency-error" : undefined}
          />
          <FieldError id="currency-error" message={fe?.bonusCurrency} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">{t("bounty_form_location_label")}</Label>
          <Input
            id="location"
            name="location"
            placeholder={t("bounty_form_location_ph")}
            maxLength={120}
            value={locationInput}
            onChange={(event) => setLocationInput(event.target.value)}
            invalid={Boolean(fe?.location)}
            aria-describedby={fe?.location ? "location-error" : undefined}
          />
          <FieldError id="location-error" message={fe?.location} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="industry">{t("bounty_form_industry_label")}</Label>
          <Input
            id="industry"
            name="industry"
            placeholder={t("bounty_form_industry_ph")}
            maxLength={80}
            value={industryInput}
            onChange={(event) => setIndustryInput(event.target.value)}
            invalid={Boolean(fe?.industry)}
            aria-describedby={fe?.industry ? "industry-error" : undefined}
          />
          <FieldError id="industry-error" message={fe?.industry} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags">{t("bounty_form_tags_label")}</Label>
        <Input
          id="tags"
          name="tags"
          placeholder="react, typescript, backend"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          invalid={Boolean(fe?.tags)}
          aria-describedby={fe?.tags ? "tags-error" : "tags-help"}
        />
        <FieldError id="tags-error" message={fe?.tags} />
        {!fe?.tags && (
          <p id="tags-help" className="text-xs text-[var(--color-text-faint)]">
            {t("bounty_form_tags_help")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expiresAt">{t("bounty_form_expires_label")}</Label>
        <Input
          id="expiresAt"
          name="expiresAt"
          type="datetime-local"
          value={expiresAtInput}
          onChange={(event) => setExpiresAtInput(event.target.value)}
          invalid={Boolean(fe?.expiresAt)}
          aria-describedby={fe?.expiresAt ? "expires-error" : "expires-help"}
        />
        <FieldError id="expires-error" message={fe?.expiresAt} />
        {!fe?.expiresAt && (
          <p id="expires-help" className="text-xs text-[var(--color-text-faint)]">
            {t("bounty_form_expires_help")}
          </p>
        )}
      </div>

      {/* ── Automatischer Auszahlungssplit (40/40/20) ── */}
      <fieldset className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] p-4">
        <legend className="px-1 text-sm font-medium text-[var(--color-text-primary)]">
          {t("bounty_form_split_legend")}
        </legend>
        <p className="text-xs text-[var(--color-text-faint)]">{t("bounty_form_split_intro")}</p>
        <input
          id="splitInserentBps"
          type="hidden"
          name="splitInserentBps"
          value={DEFAULT_SPLIT.inserentBps}
        />
        <input
          id="splitCandidateBps"
          type="hidden"
          name="splitCandidateBps"
          value={DEFAULT_SPLIT.candidateBps}
        />
        <input
          id="splitPlatformBps"
          type="hidden"
          name="splitPlatformBps"
          value={DEFAULT_SPLIT.platformBps}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="splitInserentBps">{t("bounty_form_split_a")}</Label>
            <div className="h-10 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-2)] px-3 text-sm leading-10 text-[var(--color-text-primary)]">
              {splitPreview.referrer}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="splitCandidateBps">{t("bounty_form_split_b")}</Label>
            <div className="h-10 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-2)] px-3 text-sm leading-10 text-[var(--color-text-primary)]">
              {splitPreview.candidate}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="splitPlatformBps">{t("bounty_form_split_p")}</Label>
            <div className="h-10 rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-2)] px-3 text-sm leading-10 text-[var(--color-text-primary)]">
              {splitPreview.platform}
            </div>
          </div>
        </div>
        {state.status === "error" && fe?._root && (
          <FormAlert>{fe._root}</FormAlert>
        )}
      </fieldset>

      {/* ── Zustimmungen ── */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="acceptPaymentTerms">{t("bounty_form_acceptances_label")}</Label>
        <p className="text-xs text-[var(--color-text-faint)]">{t("bounty_form_acceptances_help")}</p>
        <div className="flex items-start gap-2">
          <input type="hidden" name="paymentMode" value="on_confirmation" />
          <input
            id="acceptPaymentTerms"
            name="acceptPaymentTerms"
            type="checkbox"
            value="true"
            checked={acceptPaymentTermsChecked}
            onChange={(event) => setAcceptPaymentTermsChecked(event.target.checked)}
            disabled={!paymentTermsUnlocked}
            className="mt-0.5 h-4 w-4 rounded border border-[var(--color-surface-border)]"
            aria-describedby={fe?.acceptPaymentTerms ? "terms-error" : "terms-lock-hint payment-open-hint"}
          />
          <label htmlFor="acceptPaymentTerms" className="text-sm text-[var(--color-text-primary)]">
            {t("bounty_form_terms_checkbox_prefix")}{" "}
            <Link
              href="/legal/payment-terms?from=bounty-new&doc=payment"
              onClick={handleOpenPaymentTerms}
              className="underline hover:text-[var(--color-brand-400)]"
            >
              {t("bounty_form_terms_link_text")}
            </Link>
          </label>
        </div>
        <FieldError id="terms-error" message={fe?.acceptPaymentTerms} />
        {!paymentTermsUnlocked && (
          <p id="terms-lock-hint" className="text-xs text-[var(--color-text-faint)]">
            {t("bounty_form_terms_scroll_hint")}
          </p>
        )}
        <p id="payment-open-hint" className="text-xs text-[var(--color-text-faint)]">
          {t("bounty_form_terms_open_hint")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <input
            id="acceptAgbTerms"
            name="acceptAgbTerms"
            type="checkbox"
            value="true"
            checked={acceptAgbTermsChecked}
            onChange={(event) => setAcceptAgbTermsChecked(event.target.checked)}
            disabled={!agbUnlocked}
            className="mt-0.5 h-4 w-4 rounded border border-[var(--color-surface-border)]"
            aria-describedby={fe?.acceptAgbTerms ? "agb-error" : "agb-lock-hint agb-open-hint"}
          />
          <label htmlFor="acceptAgbTerms" className="text-sm text-[var(--color-text-primary)]">
            {t("bounty_form_agb_checkbox_prefix")}{" "}
            <Link
              href="/legal/terms?from=bounty-new&doc=agb"
              onClick={handleOpenAgb}
              className="underline hover:text-[var(--color-brand-400)]"
            >
              {t("bounty_form_agb_link_text")}
            </Link>
          </label>
        </div>
        <FieldError id="agb-error" message={fe?.acceptAgbTerms} />
        {!agbUnlocked && (
          <p id="agb-lock-hint" className="text-xs text-[var(--color-text-faint)]">
            {t("bounty_form_agb_scroll_hint")}
          </p>
        )}
        <p id="agb-open-hint" className="text-xs text-[var(--color-text-faint)]">
          {t("bounty_form_agb_open_hint")}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-surface-border)] pt-6">
        <p className="text-xs text-[var(--color-text-faint)]">{t("bounty_form_footer_hint")}</p>
        <SubmitButton saving={t("bounty_form_saving")} label={t("bounty_form_submit")} />
      </div>
    </form>
  );
}
