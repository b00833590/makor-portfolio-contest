import { describe, it, expect } from "vitest";
import { diversificationBadges } from "./diversification";
import { baseContext } from "./badge-test-context";

function ev(code: string) {
  const b = diversificationBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}

describe("PORTEFEUILLE_COMPLET", () => {
  it("attribué au max de positions", () =>
    expect(ev("PORTEFEUILLE_COMPLET")(baseContext({ openPositionCount: 20, maxPositions: 20 }))).toBe(true));
  it("pas attribué en dessous", () =>
    expect(ev("PORTEFEUILLE_COMPLET")(baseContext({ openPositionCount: 19, maxPositions: 20 }))).toBe(false));
});

describe("RIEN_DANS_UN_PANIER", () => {
  it("attribué : 9 positions, concentration max 11%", () =>
    expect(ev("RIEN_DANS_UN_PANIER")(baseContext({ openPositionCount: 9, maxPositionConcentrationPct: 11 }))).toBe(true));
  it("pas attribué : concentration 12.1%", () =>
    expect(ev("RIEN_DANS_UN_PANIER")(baseContext({ openPositionCount: 9, maxPositionConcentrationPct: 12.1 }))).toBe(false));
  it("pas attribué : moins de 9 positions", () =>
    expect(ev("RIEN_DANS_UN_PANIER")(baseContext({ openPositionCount: 8, maxPositionConcentrationPct: 5 }))).toBe(false));
  it("pas attribué : concentration inconnue", () =>
    expect(ev("RIEN_DANS_UN_PANIER")(baseContext({ openPositionCount: 9, maxPositionConcentrationPct: null }))).toBe(false));
});

describe("TOUCHE_A_TOUT", () => {
  it("attribué si actions + crypto", () =>
    expect(ev("TOUCHE_A_TOUT")(baseContext({ holdsStockAndCrypto: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("TOUCHE_A_TOUT")(baseContext({ holdsStockAndCrypto: false }))).toBe(false));
});

describe("COLLECTIONNEUR", () => {
  it("attribué à 25 actifs distincts tradés", () =>
    expect(ev("COLLECTIONNEUR")(baseContext({ distinctAssetsTradedCount: 25 }))).toBe(true));
  it("pas attribué à 24", () =>
    expect(ev("COLLECTIONNEUR")(baseContext({ distinctAssetsTradedCount: 24 }))).toBe(false));
});
