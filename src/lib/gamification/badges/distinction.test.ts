import { describe, it, expect } from "vitest";
import { distinctionBadges } from "./distinction";
import { baseContext, NOW } from "./badge-test-context";

const CLOSE_ONLY = new Set([
  "CHAMPION_DU_CONCOURS", "LE_PHENIX", "MEILLEUR_STOCK_PICKER",
  "MEILLEUR_TACTICIEN", "OEIL_DE_LYNX", "FIDELE_AU_POSTE", "SANS_FAUTE",
]);

describe("distinctionBadges", () => {
  it("contient 9 badges DISTINCTION", () => {
    expect(distinctionBadges).toHaveLength(9);
    expect(distinctionBadges.every((b) => b.category === "DISTINCTION")).toBe(true);
  });

  it("les badges close-only n'ont pas de fonction evaluate", () => {
    for (const b of distinctionBadges) {
      if (CLOSE_ONLY.has(b.code)) expect(b.evaluate).toBeUndefined();
      else expect(typeof b.evaluate).toBe("function");
    }
  });
});

function ev(code: string) {
  const b = distinctionBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}

describe("INTOUCHABLE", () => {
  it("attribué à 12 snapshots cumulés en tête", () => {
    const rankHistory = Array.from({ length: 15 }, (_, i) => ({ timestamp: NOW, rank: i < 12 ? 1 : 2 }));
    expect(ev("INTOUCHABLE")(baseContext({ rankHistory }))).toBe(true);
  });
  it("pas attribué à 11 cumulés", () => {
    const rankHistory = Array.from({ length: 15 }, (_, i) => ({ timestamp: NOW, rank: i < 11 ? 1 : 2 }));
    expect(ev("INTOUCHABLE")(baseContext({ rankHistory }))).toBe(false);
  });
});

describe("PERFECTION", () => {
  it("attribué si tous les autres badges sont possédés", () =>
    expect(ev("PERFECTION")(baseContext({ alreadyOwnedCodes: new Set(Array.from({ length: 39 }, (_, i) => `X${i}`)), totalBadgeCount: 40 }))).toBe(true));
  it("pas attribué s'il en manque deux", () =>
    expect(ev("PERFECTION")(baseContext({ alreadyOwnedCodes: new Set(Array.from({ length: 38 }, (_, i) => `X${i}`)), totalBadgeCount: 40 }))).toBe(false));
});
