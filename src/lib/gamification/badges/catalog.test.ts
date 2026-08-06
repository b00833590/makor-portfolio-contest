import { describe, it, expect } from "vitest";
import type { BadgeCategory, BadgeRarity } from "@/generated/prisma/enums";
import { BADGE_CATALOG, BADGE_CATALOG_BY_CODE, CLOSE_ONLY_CODES, evaluateBadgeCatalog } from "./catalog";
import { baseContext } from "./badge-test-context";

const CATEGORIES: BadgeCategory[] = [
  "PERFORMANCE",
  "TRADING",
  "RISK_MANAGEMENT",
  "CONVICTION",
  "DIVERSIFICATION",
  "RANKING",
  "SPECIAL_EVENT",
  "DISTINCTION",
];
const RARITIES: BadgeRarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

describe("BADGE_CATALOG", () => {
  it("contient exactement 33 badges", () => {
    expect(BADGE_CATALOG.length).toBe(33);
  });

  it("n'a aucun code dupliqué", () => {
    const codes = BADGE_CATALOG.map((badge) => badge.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("couvre toutes les catégories", () => {
    const usedCategories = new Set(BADGE_CATALOG.map((badge) => badge.category));
    for (const category of CATEGORIES) expect(usedCategories.has(category)).toBe(true);
  });

  it("couvre toutes les raretés", () => {
    const usedRarities = new Set(BADGE_CATALOG.map((badge) => badge.rarity));
    for (const rarity of RARITIES) expect(usedRarities.has(rarity)).toBe(true);
  });

  it("fournit un evaluate à tout badge qui n'est pas close-only", () => {
    for (const badge of BADGE_CATALOG) {
      if (CLOSE_ONLY_CODES.has(badge.code)) continue;
      expect(badge.evaluate, `${badge.code} devrait avoir une fonction evaluate`).toBeTypeOf("function");
    }
  });

  it("n'attribue jamais de fonction evaluate à un badge close-only", () => {
    for (const badge of BADGE_CATALOG) {
      if (!CLOSE_ONLY_CODES.has(badge.code)) continue;
      expect(badge.evaluate, `${badge.code} est close-only et ne devrait pas avoir de evaluate`).toBeUndefined();
    }
  });

  it("BADGE_CATALOG_BY_CODE indexe tous les badges", () => {
    expect(BADGE_CATALOG_BY_CODE.size).toBe(BADGE_CATALOG.length);
    expect(BADGE_CATALOG_BY_CODE.get("PREMIER_PAS")?.name).toBe("Premier pas");
  });

  it("les 4 distinctions de fin de concours sont toutes close-only", () => {
    const distinctionCodes = BADGE_CATALOG.filter((b) => b.category === "DISTINCTION").map((b) => b.code);
    expect(distinctionCodes.length).toBe(4);
    for (const code of distinctionCodes) expect(CLOSE_ONLY_CODES.has(code)).toBe(true);
  });
});

describe("evaluateBadgeCatalog", () => {
  it("ne retourne que les codes dont la condition est vraie", () => {
    const ctx = baseContext({ cumulativeReturnPct: 25, transactionCount: 1 });
    const earned = evaluateBadgeCatalog(ctx);
    expect(earned).toContain("PREMIER_ENVOL");
    expect(earned).toContain("DANS_LE_VERT");
    expect(earned).toContain("AUTRE_PLANETE");
    expect(earned).toContain("PREMIER_PAS");
    expect(earned).not.toContain("SUR_LE_TOIT");
  });

  it("ne retourne jamais un code close-only", () => {
    const ctx = baseContext({ alreadyOwnedCodes: new Set(), totalBadgeCount: 1 });
    const earned = evaluateBadgeCatalog(ctx);
    for (const code of earned) expect(CLOSE_ONLY_CODES.has(code)).toBe(false);
  });

  it("retourne un tableau vide sur un contexte neutre", () => {
    expect(evaluateBadgeCatalog(baseContext())).toEqual([]);
  });
});
