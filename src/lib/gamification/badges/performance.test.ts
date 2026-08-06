import { describe, it, expect } from "vitest";
import { performanceBadges } from "./performance";
import { baseContext, NOW } from "./badge-test-context";

function spec(code: string) {
  const found = performanceBadges.find((badge) => badge.code === code);
  if (!found?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return found.evaluate;
}

describe("PREMIER_ENVOL", () => {
  it("est attribué à partir de +5% de rendement cumulé", () => {
    expect(spec("PREMIER_ENVOL")(baseContext({ cumulativeReturnPct: 5 }))).toBe(true);
  });
  it("n'est pas attribué en dessous de +5%", () => {
    expect(spec("PREMIER_ENVOL")(baseContext({ cumulativeReturnPct: 4.9 }))).toBe(false);
  });
});

describe("DANS_LE_VERT", () => {
  it("est attribué à partir de +10%", () => {
    expect(spec("DANS_LE_VERT")(baseContext({ cumulativeReturnPct: 10 }))).toBe(true);
  });
  it("n'est pas attribué en dessous de +10%", () => {
    expect(spec("DANS_LE_VERT")(baseContext({ cumulativeReturnPct: 9 }))).toBe(false);
  });
});

describe("AUTRE_PLANETE", () => {
  it("est attribué à partir de +20%", () => {
    expect(spec("AUTRE_PLANETE")(baseContext({ cumulativeReturnPct: 20 }))).toBe(true);
  });
  it("n'est pas attribué en dessous de +20%", () => {
    expect(spec("AUTRE_PLANETE")(baseContext({ cumulativeReturnPct: 19.9 }))).toBe(false);
  });
});

describe("SUR_LE_TOIT", () => {
  it("est attribué dès que le rang courant est 1", () => {
    expect(spec("SUR_LE_TOIT")(baseContext({ currentRank: 1 }))).toBe(true);
  });
  it("n'est pas attribué si le rang courant n'est pas 1", () => {
    expect(spec("SUR_LE_TOIT")(baseContext({ currentRank: 2 }))).toBe(false);
  });
  it("n'est pas attribué sans rang connu", () => {
    expect(spec("SUR_LE_TOIT")(baseContext({ currentRank: null }))).toBe(false);
  });
});

describe("ROI_DE_LA_SEMAINE", () => {
  it("est attribué si les 7 derniers points d'historique sont tous rang 1", () => {
    const rankHistory = Array.from({ length: 7 }, () => ({ timestamp: NOW, rank: 1 }));
    expect(spec("ROI_DE_LA_SEMAINE")(baseContext({ rankHistory }))).toBe(true);
  });
  it("n'est pas attribué si un seul jour n'est pas rang 1", () => {
    const rankHistory = [
      { timestamp: NOW, rank: 1 },
      { timestamp: NOW, rank: 2 },
      { timestamp: NOW, rank: 1 },
      { timestamp: NOW, rank: 1 },
      { timestamp: NOW, rank: 1 },
      { timestamp: NOW, rank: 1 },
      { timestamp: NOW, rank: 1 },
    ];
    expect(spec("ROI_DE_LA_SEMAINE")(baseContext({ rankHistory }))).toBe(false);
  });
  it("n'est pas attribué s'il y a moins de 7 jours d'historique", () => {
    const rankHistory = Array.from({ length: 6 }, () => ({ timestamp: NOW, rank: 1 }));
    expect(spec("ROI_DE_LA_SEMAINE")(baseContext({ rankHistory }))).toBe(false);
  });
});

describe("LE_RETOUR", () => {
  it("est attribué si actuellement Top 3 et a déjà été dernier", () => {
    const ctx = baseContext({
      currentRank: 2,
      participantCount: 10,
      rankHistory: [{ timestamp: NOW, rank: 10 }],
    });
    expect(spec("LE_RETOUR")(ctx)).toBe(true);
  });
  it("n'est pas attribué si jamais été dernier", () => {
    const ctx = baseContext({
      currentRank: 2,
      participantCount: 10,
      rankHistory: [{ timestamp: NOW, rank: 5 }],
    });
    expect(spec("LE_RETOUR")(ctx)).toBe(false);
  });
  it("n'est pas attribué si pas actuellement Top 3", () => {
    const ctx = baseContext({
      currentRank: 4,
      participantCount: 10,
      rankHistory: [{ timestamp: NOW, rank: 10 }],
    });
    expect(spec("LE_RETOUR")(ctx)).toBe(false);
  });
});

