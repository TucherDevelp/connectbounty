import { describe, expect, it } from "vitest";
import { bountyCreateSchema, bountyIdSchema } from "./schemas";

const base = {
  title: "Senior Backend Engineer bei ConnectBounty",
  description:
    "Wir suchen einen Backend-Engineer mit Fokus auf Node.js, Postgres und Supabase-RLS.",
  bonusAmount: "1500",
  bonusCurrency: "eur",
  location: "Berlin",
  industry: "Software",
  tags: "node,postgres, supabase",
  expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  acceptPaymentTerms: "true",
  acceptAgbTerms: "true",
};

describe("bountyCreateSchema", () => {
  it("akzeptiert valide Eingabe und normalisiert", () => {
    const res = bountyCreateSchema.safeParse(base);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.bonusAmount).toBe(1500);
    expect(res.data.bonusCurrency).toBe("EUR");
    expect(res.data.tags).toEqual(["node", "postgres", "supabase"]);
  });

  it("akzeptiert deutsche Dezimalkomma-Schreibweise", () => {
    const res = bountyCreateSchema.safeParse({ ...base, bonusAmount: "1500,50" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.bonusAmount).toBe(1500.5);
  });

  it("weist negative Prämien ab", () => {
    const res = bountyCreateSchema.safeParse({ ...base, bonusAmount: "-5" });
    expect(res.success).toBe(false);
  });

  it("weist zu hohe Prämien ab", () => {
    const res = bountyCreateSchema.safeParse({ ...base, bonusAmount: "2000000" });
    expect(res.success).toBe(false);
  });

  it("weist >2 Nachkommastellen ab", () => {
    const res = bountyCreateSchema.safeParse({ ...base, bonusAmount: "10.123" });
    expect(res.success).toBe(false);
  });

  it("weist zu kurze Titel ab", () => {
    const res = bountyCreateSchema.safeParse({ ...base, title: "abc" });
    expect(res.success).toBe(false);
  });

  it("weist zu kurze Beschreibung ab", () => {
    const res = bountyCreateSchema.safeParse({ ...base, description: "zu kurz" });
    expect(res.success).toBe(false);
  });

  it("weist Vergangenes Ablaufdatum ab", () => {
    const res = bountyCreateSchema.safeParse({
      ...base,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(res.success).toBe(false);
  });

  it("erlaubt fehlendes Ablaufdatum", () => {
    const res = bountyCreateSchema.safeParse({ ...base, expiresAt: "" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.expiresAt).toBeNull();
  });

  it("dedupliziert Tags", () => {
    const res = bountyCreateSchema.safeParse({ ...base, tags: "node,Node,NODE, postgres" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.tags).toEqual(["node", "postgres"]);
  });

  it("weist zu viele Tags ab", () => {
    const many = Array.from({ length: 11 }, (_, i) => `tag${i}`).join(",");
    const res = bountyCreateSchema.safeParse({ ...base, tags: many });
    expect(res.success).toBe(false);
  });

  it("weist ungültige Tag-Zeichen ab", () => {
    const res = bountyCreateSchema.safeParse({ ...base, tags: "node js,c++" });
    expect(res.success).toBe(false);
  });

  it("weist ungültige Währung ab", () => {
    const res = bountyCreateSchema.safeParse({ ...base, bonusCurrency: "EU" });
    expect(res.success).toBe(false);
  });

  it("konvertiert leere location/industry zu null", () => {
    const res = bountyCreateSchema.safeParse({ ...base, location: "", industry: "" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.location).toBeNull();
      expect(res.data.industry).toBeNull();
    }
  });

  it("weist fehlende Akzeptanz der Zahlungsbedingungen ab", () => {
    const res = bountyCreateSchema.safeParse({ ...base, acceptPaymentTerms: "false" });
    expect(res.success).toBe(false);
  });

  it("lässt nur on_confirmation als Zahlungsmodus zu", () => {
    const res = bountyCreateSchema.safeParse({ ...base, paymentMode: "escrow" });
    expect(res.success).toBe(false);
  });

  it("weist fehlende Akzeptanz der AGB ab", () => {
    const res = bountyCreateSchema.safeParse({ ...base, acceptAgbTerms: "false" });
    expect(res.success).toBe(false);
  });
});

describe("bountyIdSchema", () => {
  it("akzeptiert UUIDs", () => {
    const res = bountyIdSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111" });
    expect(res.success).toBe(true);
  });

  it("lehnt Non-UUIDs ab", () => {
    const res = bountyIdSchema.safeParse({ id: "not-a-uuid" });
    expect(res.success).toBe(false);
  });
});
