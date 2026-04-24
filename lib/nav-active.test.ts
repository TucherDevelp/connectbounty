import { describe, expect, it } from "vitest";
import { isNavItemActive } from "./nav-active";

describe("isNavItemActive", () => {
  it("marks /bounties/mine only for my bounties, not marketplace", () => {
    expect(isNavItemActive("/bounties/mine", "/bounties", false)).toBe(false);
    expect(isNavItemActive("/bounties/mine", "/bounties/mine", false)).toBe(true);
  });

  it("marks marketplace for list and bounty detail", () => {
    expect(isNavItemActive("/bounties", "/bounties", false)).toBe(true);
    expect(isNavItemActive("/bounties/abc-123", "/bounties", false)).toBe(true);
  });

  it("excludes /bounties/new from marketplace", () => {
    expect(isNavItemActive("/bounties/new", "/bounties", false)).toBe(false);
  });

  it("respects exact", () => {
    expect(isNavItemActive("/admin/bounties", "/admin", true)).toBe(false);
    expect(isNavItemActive("/admin", "/admin", true)).toBe(true);
  });
});
