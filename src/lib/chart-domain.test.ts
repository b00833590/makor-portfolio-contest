import { describe, it, expect } from "vitest";
import { computeTightDomain } from "./chart-domain";

describe("computeTightDomain", () => {
  it("returns undefined for no values", () => {
    expect(computeTightDomain([])).toBeUndefined();
  });

  it("pads a tight range proportionally instead of anchoring at zero", () => {
    const [min, max] = computeTightDomain([990_000, 1_050_000])!;
    expect(min).toBeGreaterThan(900_000);
    expect(min).toBeLessThan(990_000);
    expect(max).toBeGreaterThan(1_050_000);
  });

  it("still pads a flat series so the line isn't glued to the edge", () => {
    const [min, max] = computeTightDomain([1_000_000, 1_000_000])!;
    expect(min).toBeLessThan(1_000_000);
    expect(max).toBeGreaterThan(1_000_000);
  });
});
