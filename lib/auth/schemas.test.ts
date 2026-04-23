import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  requestResetSchema,
  updatePasswordSchema,
} from "./schemas";

describe("loginSchema", () => {
  it("accepts valid input", () => {
    expect(loginSchema.safeParse({ email: "a@b.de", password: "x" }).success).toBe(true);
  });

  it("rejects invalid email", () => {
    const r = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["email"]);
  });

  it("rejects empty password", () => {
    const r = loginSchema.safeParse({ email: "a@b.de", password: "" });
    expect(r.success).toBe(false);
  });

  it("trims email", () => {
    const r = loginSchema.safeParse({ email: "  a@b.de  ", password: "x" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@b.de");
  });
});

describe("registerSchema", () => {
  const valid = {
    email: "a@b.de",
    password: "Sicher12345!",
    confirmPassword: "Sicher12345!",
    displayName: "Olli",
    terms: "on",
  };

  it("accepts valid input", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("requires 12+ chars in password", () => {
    const r = registerSchema.safeParse({ ...valid, password: "Kurz12!", confirmPassword: "Kurz12!" });
    expect(r.success).toBe(false);
  });

  it("requires 3 char classes", () => {
    const r = registerSchema.safeParse({
      ...valid,
      password: "alleskleinklein",
      confirmPassword: "alleskleinklein",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /3 von/.test(i.message))).toBe(true);
    }
  });

  it("rejects mismatched passwords", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "Anderswert12!" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("confirmPassword"))).toBe(true);
    }
  });

  it("requires terms acceptance", () => {
    const r = registerSchema.safeParse({ ...valid, terms: false });
    expect(r.success).toBe(false);
  });

  it("rejects too-short display name", () => {
    const r = registerSchema.safeParse({ ...valid, displayName: "X" });
    expect(r.success).toBe(false);
  });
});

describe("requestResetSchema", () => {
  it("accepts valid email", () => {
    expect(requestResetSchema.safeParse({ email: "a@b.de" }).success).toBe(true);
  });
  it("rejects empty email", () => {
    expect(requestResetSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("accepts strong matching passwords", () => {
    expect(
      updatePasswordSchema.safeParse({
        password: "NeuesPW9999!",
        confirmPassword: "NeuesPW9999!",
      }).success,
    ).toBe(true);
  });
  it("rejects mismatch", () => {
    const r = updatePasswordSchema.safeParse({
      password: "NeuesPW9999!",
      confirmPassword: "AndererPW999!",
    });
    expect(r.success).toBe(false);
  });
});
