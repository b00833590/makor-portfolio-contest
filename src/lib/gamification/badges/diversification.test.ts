import { describe, it, expect } from "vitest";
import { diversificationBadges } from "./diversification";
import { baseContext } from "./badge-test-context";

function spec(code: string) {
  const found = diversificationBadges.find((badge) => badge.code === code);
  if (!found?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return found.evaluate;
}

describe("PORTEFEUILLE_COMPLET", () => {
  it("est attribué quand le nombre de positions atteint le maximum", () => {
    expect(spec("PORTEFEUILLE_COMPLET")(baseContext({ openPositionCount: 20, maxPositions: 20 }))).toBe(true);
  });
  it("n'est pas attribué en dessous du maximum", () => {
    expect(spec("PORTEFEUILLE_COMPLET")(baseContext({ openPositionCount: 19, maxPositions: 20 }))).toBe(false);
  });
  it("s'adapte à une limite personnalisée par l'admin", () => {
    expect(spec("PORTEFEUILLE_COMPLET")(baseContext({ openPositionCount: 15, maxPositions: 15 }))).toBe(true);
  });
});

describe("MULTI_SECTEURS", () => {
  it("est attribué à partir de 5 secteurs distincts", () => {
    const sectorAllocation = Array.from({ length: 5 }, (_, i) => ({ key: `secteur-${i}`, valuePct: 20 }));
    expect(spec("MULTI_SECTEURS")(baseContext({ sectorAllocation }))).toBe(true);
  });
  it("n'est pas attribué en dessous de 5 secteurs", () => {
    const sectorAllocation = Array.from({ length: 4 }, (_, i) => ({ key: `secteur-${i}`, valuePct: 25 }));
    expect(spec("MULTI_SECTEURS")(baseContext({ sectorAllocation }))).toBe(false);
  });
});

describe("TOUR_DU_MONDE", () => {
  it("est attribué à partir de 2 devises distinctes", () => {
    const currencyAllocation = [
      { key: "EUR", valuePct: 60 },
      { key: "USD", valuePct: 40 },
    ];
    expect(spec("TOUR_DU_MONDE")(baseContext({ currencyAllocation }))).toBe(true);
  });
  it("n'est pas attribué avec une seule devise", () => {
    const currencyAllocation = [{ key: "EUR", valuePct: 100 }];
    expect(spec("TOUR_DU_MONDE")(baseContext({ currencyAllocation }))).toBe(false);
  });
});
