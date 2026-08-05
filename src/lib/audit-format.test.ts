import { describe, it, expect } from "vitest";
import { formatAuditChange } from "./audit-format";

describe("formatAuditChange", () => {
  it("shows only the fields that actually changed, not the whole objects", () => {
    const result = formatAuditChange(
      { maxCryptoPositions: 1, maxPositions: 20, name: "Promo" },
      { maxCryptoPositions: 2, maxPositions: 20, name: "Promo" },
    );

    expect(result).toBe("maxCryptoPositions : 1 → 2");
  });

  it("lists multiple changed fields separated by a bullet", () => {
    const result = formatAuditChange({ a: 1, b: "x" }, { a: 2, b: "y" });

    expect(result).toContain("a : 1 → 2");
    expect(result).toContain("b : x → y");
  });

  it("falls back to a before/after dump for non-object values", () => {
    const result = formatAuditChange("STOCK", "CRYPTO");

    expect(result).toBe('avant : "STOCK" · après : "CRYPTO"');
  });

  it("handles a create action with no before value", () => {
    const result = formatAuditChange(undefined, { name: "New promo" });

    expect(result).toBe('après : {"name":"New promo"}');
  });

  it("renders '—' for a field that only exists on one side", () => {
    const result = formatAuditChange({ a: 1 }, { a: 1, b: "new" });

    expect(result).toBe("b : — → new");
  });

  it("returns an empty string when nothing changed", () => {
    const result = formatAuditChange({ a: 1 }, { a: 1 });

    expect(result).toBe("");
  });
});
