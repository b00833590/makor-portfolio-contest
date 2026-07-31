import { describe, it, expect } from "vitest";
import { createPromotionSchema } from "./schema";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Promotion Été 2026",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    initialCapital: "1000000",
    minPositionSize: "25000",
    maxPositionSize: "100000",
    maxPositions: "20",
    maxCryptoAllocationPct: "20",
    changeSessionsPerWeek: "2",
    maxChangesPerSession: "4",
    freezeHoursBeforeEnd: "48",
    ...overrides,
  };
}

describe("createPromotionSchema", () => {
  it("accepts a valid promotion submitted as form-data strings", () => {
    const result = createPromotionSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createPromotionSchema.safeParse(validInput({ name: "  " }));
    expect(result.success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const result = createPromotionSchema.safeParse(
      validInput({ startDate: "2026-09-30", endDate: "2026-09-01" }),
    );

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.path).toEqual(["endDate"]);
  });

  it("rejects a max position size smaller than the min", () => {
    const result = createPromotionSchema.safeParse(
      validInput({ minPositionSize: "100000", maxPositionSize: "25000" }),
    );

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.path).toEqual(["maxPositionSize"]);
  });
});
