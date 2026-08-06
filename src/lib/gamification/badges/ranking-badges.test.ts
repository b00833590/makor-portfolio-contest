import { describe, it, expect } from "vitest";
import { rankingBadges } from "./ranking-badges";
import { baseContext, NOW } from "./badge-test-context";

function spec(code: string) {
  const found = rankingBadges.find((badge) => badge.code === code);
  if (!found?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return found.evaluate;
}

describe("FUSEE", () => {
  it("est attribué à partir de +8% en une journée", () => {
    expect(spec("FUSEE")(baseContext({ dailyReturnPct: 8 }))).toBe(true);
  });
  it("n'est pas attribué en dessous de +8%", () => {
    expect(spec("FUSEE")(baseContext({ dailyReturnPct: 7.9 }))).toBe(false);
  });
  it("n'est pas attribué sans rendement journalier connu", () => {
    expect(spec("FUSEE")(baseContext({ dailyReturnPct: null }))).toBe(false);
  });
});

describe("REMONTADA", () => {
  it("est attribué pour un gain d'au moins 5 places en un jour", () => {
    expect(spec("REMONTADA")(baseContext({ currentRank: 3, previousRank: 8 }))).toBe(true);
  });
  it("n'est pas attribué pour moins de 5 places gagnées", () => {
    expect(spec("REMONTADA")(baseContext({ currentRank: 5, previousRank: 8 }))).toBe(false);
  });
  it("n'est pas attribué sans historique de rang", () => {
    expect(spec("REMONTADA")(baseContext({ currentRank: 1, previousRank: null }))).toBe(false);
  });
});

describe("DOMINATION", () => {
  it("est attribué 1er avec au moins 10 points d'avance", () => {
    expect(spec("DOMINATION")(baseContext({ currentRank: 1, gapToSecondPts: 10 }))).toBe(true);
  });
  it("n'est pas attribué avec moins de 10 points d'avance", () => {
    expect(spec("DOMINATION")(baseContext({ currentRank: 1, gapToSecondPts: 9.9 }))).toBe(false);
  });
  it("n'est pas attribué si pas 1er", () => {
    expect(spec("DOMINATION")(baseContext({ currentRank: 2, gapToSecondPts: 15 }))).toBe(false);
  });
});

describe("INVINCIBLE", () => {
  it("est attribué pour 14 jours consécutifs en tête", () => {
    const rankHistory = Array.from({ length: 14 }, () => ({ timestamp: NOW, rank: 1 }));
    expect(spec("INVINCIBLE")(baseContext({ rankHistory }))).toBe(true);
  });
  it("n'est pas attribué avec seulement 13 jours", () => {
    const rankHistory = Array.from({ length: 13 }, () => ({ timestamp: NOW, rank: 1 }));
    expect(spec("INVINCIBLE")(baseContext({ rankHistory }))).toBe(false);
  });
});
