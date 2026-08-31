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

  it("rejects a negative max crypto positions count", () => {
    const result = promotionRulesSchema.safeParse({
      ...defaultPromotionRules,
      maxCryptoPositions: -1,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a zero max crypto positions count (crypto disabled)", () => {
    const result = promotionRulesSchema.safeParse({
      ...defaultPromotionRules,
      maxCryptoPositions: 0,
    });

    expect(result.success).toBe(true);
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

  it("rejects a zero or negative initialization window duration", () => {
    const result = promotionRulesSchema.safeParse({
      ...defaultPromotionRules,
      initializationWindowHours: 0,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a fractional initialization window duration (e.g. 1.5h)", () => {
    const result = promotionRulesSchema.safeParse({
      ...defaultPromotionRules,
      initializationWindowHours: 1.5,
    });

    expect(result.success).toBe(true);
  });
});

describe("defaultPromotionRules", () => {
  it("propose 1 session de changement par semaine et 6 changements par session", () => {
    expect(defaultPromotionRules.changeSessionsPerWeek).toBe(1);
    expect(defaultPromotionRules.maxChangesPerSession).toBe(6);
  });

  it("reste un jeu de règles valide au regard du schéma", () => {
    expect(() => promotionRulesSchema.parse(defaultPromotionRules)).not.toThrow();
  });
});
