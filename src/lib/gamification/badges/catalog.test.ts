import { describe, it, expect } from "vitest";
import { BADGE_CATALOG, BADGE_CATALOG_BY_CODE, CLOSE_ONLY_CODES } from "./catalog";
import { baseContext } from "./badge-test-context";

describe("BADGE_CATALOG", () => {
  it("contient 40 badges aux codes uniques", () => {
    expect(BADGE_CATALOG).toHaveLength(40);
    expect(new Set(BADGE_CATALOG.map((b) => b.code)).size).toBe(40);
  });

  it("chaque badge a nom, description, condition, catégorie, rareté, icône non vides", () => {
    for (const b of BADGE_CATALOG) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.description.length).toBeGreaterThan(0);
      expect(b.condition.length).toBeGreaterThan(0);
      expect(b.icon.length).toBeGreaterThan(0);
      expect(["PERFORMANCE", "TRADING", "RISK_MANAGEMENT", "DIVERSIFICATION", "RANKING", "SPECIAL_EVENT", "DISTINCTION", "CONVICTION"]).toContain(b.category);
      expect(["COMMON", "RARE", "EPIC", "LEGENDARY"]).toContain(b.rarity);
    }
  });

  it("les codes close-only n'ont pas de evaluate, les autres en ont un", () => {
    for (const b of BADGE_CATALOG) {
      if (CLOSE_ONLY_CODES.has(b.code)) expect(b.evaluate).toBeUndefined();
      else expect(typeof b.evaluate).toBe("function");
    }
  });

  it("CLOSE_ONLY_CODES contient exactement les 8 codes attendus", () => {
    expect([...CLOSE_ONLY_CODES].sort()).toEqual(
      [
        "CHAMPION_DU_CONCOURS", "FIDELE_AU_POSTE", "LE_PHENIX", "MEILLEUR_STOCK_PICKER",
        "MEILLEUR_TACTICIEN", "OEIL_DE_LYNX", "SANS_FAUTE", "STRATEGE_ASSIDU",
      ].sort(),
    );
  });

  it("un contexte neutre n'attribue aucun badge", () => {
    const earned = BADGE_CATALOG.filter((b) => b.evaluate?.(baseContext()) ?? false);
    expect(earned).toEqual([]);
  });

  it("BADGE_CATALOG_BY_CODE indexe tout le catalogue", () => {
    expect(BADGE_CATALOG_BY_CODE.size).toBe(40);
  });
});
