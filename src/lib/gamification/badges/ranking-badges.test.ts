import { describe, it, expect } from "vitest";
import { rankingBadges } from "./ranking-badges";
import { baseContext, NOW } from "./badge-test-context";

function ev(code: string) {
  const b = rankingBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}
const rh = (ranks: (number | null)[]) => ranks.map((rank) => ({ timestamp: NOW, rank }));

describe("SUR_LE_PODIUM", () => {
  it("attribué au top 3 (>= 4 participants)", () =>
    expect(ev("SUR_LE_PODIUM")(baseContext({ currentRank: 3, participantCount: 6 }))).toBe(true));
  it("pas attribué en 4e", () =>
    expect(ev("SUR_LE_PODIUM")(baseContext({ currentRank: 4, participantCount: 6 }))).toBe(false));
  it("pas attribué à moins de 4 participants", () =>
    expect(ev("SUR_LE_PODIUM")(baseContext({ currentRank: 1, participantCount: 3 }))).toBe(false));
});

describe("SUR_LE_TOIT", () => {
  it("attribué en 1ère place (>= 3 participants)", () =>
    expect(ev("SUR_LE_TOIT")(baseContext({ currentRank: 1, participantCount: 3 }))).toBe(true));
  it("pas attribué en 2e", () =>
    expect(ev("SUR_LE_TOIT")(baseContext({ currentRank: 2, participantCount: 3 }))).toBe(false));
});

describe("CHASSEUR_DE_TETE", () => {
  it("attribué quand on reprend la 1ère place après l'avoir perdue", () =>
    expect(ev("CHASSEUR_DE_TETE")(baseContext({ regainedFirstPlace: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("CHASSEUR_DE_TETE")(baseContext({ regainedFirstPlace: false }))).toBe(false));
});

describe("MEILLEURE_SEMAINE", () => {
  it("attribué au meilleur rendement hebdo du concours", () =>
    expect(ev("MEILLEURE_SEMAINE")(baseContext({ hasBestWeeklyReturn: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("MEILLEURE_SEMAINE")(baseContext({ hasBestWeeklyReturn: false }))).toBe(false));
});

describe("FUSEE", () => {
  it("attribué à +8% en une journée", () =>
    expect(ev("FUSEE")(baseContext({ dailyReturnPct: 8 }))).toBe(true));
  it("pas attribué à +7.9%", () =>
    expect(ev("FUSEE")(baseContext({ dailyReturnPct: 7.9 }))).toBe(false));
  it("pas attribué sans rendement journalier", () =>
    expect(ev("FUSEE")(baseContext({ dailyReturnPct: null }))).toBe(false));
});

describe("REMONTADA", () => {
  it("attribué pour +5 places en un jour", () =>
    expect(ev("REMONTADA")(baseContext({ currentRank: 3, previousRank: 8 }))).toBe(true));
  it("pas attribué pour +4 places", () =>
    expect(ev("REMONTADA")(baseContext({ currentRank: 4, previousRank: 8 }))).toBe(false));
  it("pas attribué sans rang précédent", () =>
    expect(ev("REMONTADA")(baseContext({ currentRank: 1, previousRank: null }))).toBe(false));
});

describe("DOMINATION", () => {
  it("attribué 1er avec +8 pts d'avance", () =>
    expect(ev("DOMINATION")(baseContext({ currentRank: 1, gapToSecondPts: 8 }))).toBe(true));
  it("pas attribué avec +7.9 pts", () =>
    expect(ev("DOMINATION")(baseContext({ currentRank: 1, gapToSecondPts: 7.9 }))).toBe(false));
  it("pas attribué si pas 1er", () =>
    expect(ev("DOMINATION")(baseContext({ currentRank: 2, gapToSecondPts: 20 }))).toBe(false));
});

describe("REGNE", () => {
  it("attribué pour 5 snapshots consécutifs en tête", () =>
    expect(ev("REGNE")(baseContext({ rankHistory: rh([1, 1, 1, 1, 1]) }))).toBe(true));
  it("pas attribué avec seulement 4", () =>
    expect(ev("REGNE")(baseContext({ rankHistory: rh([1, 1, 1, 1]) }))).toBe(false));
  it("un null casse la série", () =>
    expect(ev("REGNE")(baseContext({ rankHistory: rh([1, 1, null, 1, 1, 1]) }))).toBe(false));
});
