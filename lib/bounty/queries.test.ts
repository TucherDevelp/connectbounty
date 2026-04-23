import { describe, expect, it } from "vitest";
import { bountyFiltersSchema, PAGE_SIZE } from "./queries";

describe("bountyFiltersSchema", () => {
  it("parst leere Eingabe → default page=1", () => {
    const res = bountyFiltersSchema.parse({});
    expect(res.page).toBe(1);
    expect(res.q).toBeUndefined();
    expect(res.industry).toBeUndefined();
    expect(res.location).toBeUndefined();
    expect(res.tag).toBeUndefined();
    expect(res.minBonus).toBeUndefined();
  });

  it("parst numerische und String-Seitenzahlen", () => {
    expect(bountyFiltersSchema.parse({ page: "3" }).page).toBe(3);
    expect(bountyFiltersSchema.parse({ page: 5 }).page).toBe(5);
    expect(bountyFiltersSchema.parse({ page: "0" }).page).toBe(1);
    expect(bountyFiltersSchema.parse({ page: "abc" }).page).toBe(1);
  });

  it("normalisiert Tags auf lowercase und validiert Zeichen", () => {
    expect(bountyFiltersSchema.parse({ tag: "REACT" }).tag).toBe("react");
    expect(() => bountyFiltersSchema.parse({ tag: "node js" })).toThrow();
    expect(() => bountyFiltersSchema.parse({ tag: "c++" })).toThrow();
  });

  it("konvertiert leere Strings zu undefined", () => {
    const res = bountyFiltersSchema.parse({
      q: "",
      industry: "",
      location: "",
      tag: "",
      minBonus: "",
    });
    expect(res.q).toBeUndefined();
    expect(res.industry).toBeUndefined();
    expect(res.location).toBeUndefined();
    expect(res.tag).toBeUndefined();
    expect(res.minBonus).toBeUndefined();
  });

  it("parst Mindestprämie mit Komma", () => {
    expect(bountyFiltersSchema.parse({ minBonus: "1500,50" }).minBonus).toBe(1500.5);
    expect(bountyFiltersSchema.parse({ minBonus: 2500 }).minBonus).toBe(2500);
  });

  it("lehnt negative Mindestprämie ab", () => {
    expect(() => bountyFiltersSchema.parse({ minBonus: "-100" })).toThrow();
  });

  it("exportiert stabile Page-Size", () => {
    expect(PAGE_SIZE).toBe(20);
  });
});
