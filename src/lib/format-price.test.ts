import { describe, it, expect } from "vitest";
import { formatUnitPrice } from "./format-price";

describe("formatUnitPrice", () => {
  it("uses the standard 2-decimal EUR format at or above 1 cent", () => {
    expect(formatUnitPrice(328.21)).toBe("328,21 €");
    expect(formatUnitPrice(0.61)).toBe("0,61 €");
    expect(formatUnitPrice(0.01)).toBe("0,01 €");
  });

  it("formats exactly zero with the standard formatter", () => {
    expect(formatUnitPrice(0)).toBe("0,00 €");
  });

  it("widens decimals below 1 cent instead of collapsing to 0,00 € (the PEPE bug)", () => {
    expect(formatUnitPrice(0.00000304)).toBe("0,00000304 €");
    expect(formatUnitPrice(0.005)).toBe("0,00500 €");
  });

  it("still shows movement between two nearby micro-cap prices", () => {
    expect(formatUnitPrice(0.00000304)).not.toBe(formatUnitPrice(0.00000305));
  });

  it("caps the widened precision at 12 decimals", () => {
    const formatted = formatUnitPrice(1e-15);
    expect(formatted.replace(/[^\d]/g, "").length).toBeLessThanOrEqual(13); // 1 integer digit + 12 decimals
  });
});
