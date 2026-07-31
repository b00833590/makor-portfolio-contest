import { describe, it, expect } from "vitest";
import { promotionRulesSchema, defaultPromotionRules } from "./promotion-rules";

describe("promotionRulesSchema", () => {
  it("accepts the default rules", () => {
    expect(promotionRulesSchema.safeParse(defaultPromotionRules).success).toBe(true);
  });

  it("rejects a negative position size", () => {
    const result = promotionRulesSchema.safeParse({
      ...defaultPromotionRules,
      minPositionSize: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a crypto allocation cap above 100%", () => {
    const result = promotionRulesSchema.safeParse({
      ...defaultPromotionRules,
      maxCryptoAllocationPct: 150,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer max positions count", () => {
    const result = promotionRulesSchema.safeParse({
      ...defaultPromotionRules,
      maxPositions: 3.5,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a zero-hour freeze window", () => {
    const result = promotionRulesSchema.safeParse({
      ...defaultPromotionRules,
      freezeHoursBeforeEnd: 0,
    });

    expect(result.success).toBe(true);
  });
});
