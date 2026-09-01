import { describe, it, expect } from "vitest";
import { tradingBadges } from "./trading";
import { baseContext, NOW } from "./badge-test-context";

function ev(code: string) {
  const b = tradingBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}
const trade = (pnlEur: number, pnlPct: number) => ({ pnlEur, pnlPct, closedAt: NOW });

describe("PREMIER_PAS", () => {
  it("attribué dès 1 transaction", () => expect(ev("PREMIER_PAS")(baseContext({ transactionCount: 1 }))).toBe(true));
  it("pas attribué à 0", () => expect(ev("PREMIER_PAS")(baseContext({ transactionCount: 0 }))).toBe(false));
});

describe("PREMIERE_VICTOIRE", () => {
  it("attribué avec une vente gagnante", () =>
    expect(ev("PREMIERE_VICTOIRE")(baseContext({ closedTradesChronological: [trade(10, 1)] }))).toBe(true));
  it("pas attribué avec seulement des ventes perdantes", () =>
    expect(ev("PREMIERE_VICTOIRE")(baseContext({ closedTradesChronological: [trade(-10, -1)] }))).toBe(false));
});

describe("BEAU_MOVE", () => {
  it("attribué à une vente +12%", () =>
    expect(ev("BEAU_MOVE")(baseContext({ closedTradesChronological: [trade(100, 12)] }))).toBe(true));
  it("pas attribué à +11.9%", () =>
    expect(ev("BEAU_MOVE")(baseContext({ closedTradesChronological: [trade(100, 11.9)] }))).toBe(false));
});

describe("GROS_COUP", () => {
  it("attribué à une vente +25%", () =>
    expect(ev("GROS_COUP")(baseContext({ closedTradesChronological: [trade(100, 25)] }))).toBe(true));
  it("pas attribué à +24%", () =>
    expect(ev("GROS_COUP")(baseContext({ closedTradesChronological: [trade(100, 24)] }))).toBe(false));
});

describe("MAIN_CHAUDE", () => {
  it("attribué pour 4 ventes gagnantes consécutives", () =>
    expect(ev("MAIN_CHAUDE")(baseContext({ closedTradesChronological: [trade(1, 1), trade(1, 1), trade(1, 1), trade(1, 1)] }))).toBe(true));
  it("pas attribué si l'une est perdante", () =>
    expect(ev("MAIN_CHAUDE")(baseContext({ closedTradesChronological: [trade(1, 1), trade(-1, -1), trade(1, 1), trade(1, 1)] }))).toBe(false));
  it("attribué si 4 gagnantes consécutives précèdent une perte", () =>
    expect(ev("MAIN_CHAUDE")(baseContext({ closedTradesChronological: [trade(1, 1), trade(1, 1), trade(1, 1), trade(1, 1), trade(-1, -1)] }))).toBe(true));
  it("pas attribué avec seulement 3 ventes", () =>
    expect(ev("MAIN_CHAUDE")(baseContext({ closedTradesChronological: [trade(1, 1), trade(1, 1), trade(1, 1)] }))).toBe(false));
});

describe("ARBITRAGISTE", () => {
  it("attribué si un arbitrage réussi est détecté", () =>
    expect(ev("ARBITRAGISTE")(baseContext({ hasSuccessfulArbitrage: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("ARBITRAGISTE")(baseContext({ hasSuccessfulArbitrage: false }))).toBe(false));
});

describe("LE_BON_INSTINCT", () => {
  it("attribué si un achat prend +15% en 5 jours", () =>
    expect(ev("LE_BON_INSTINCT")(baseContext({ postBuyMaxGainPct: 15 }))).toBe(true));
  it("pas attribué à +14%", () =>
    expect(ev("LE_BON_INSTINCT")(baseContext({ postBuyMaxGainPct: 14 }))).toBe(false));
  it("pas attribué sans donnée", () =>
    expect(ev("LE_BON_INSTINCT")(baseContext({ postBuyMaxGainPct: null }))).toBe(false));
});
