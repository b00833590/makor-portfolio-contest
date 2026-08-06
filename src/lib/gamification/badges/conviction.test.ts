import { describe, it, expect } from "vitest";
import { convictionBadges, computeMaxPostBuyGainPct } from "./conviction";
import { baseContext } from "./badge-test-context";

function spec(code: string) {
  const found = convictionBadges.find((badge) => badge.code === code);
  if (!found?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return found.evaluate;
}

describe("LE_BON_INSTINCT", () => {
  it("est attribué si un achat a pris au moins 15% dans les 5 jours suivants", () => {
    expect(spec("LE_BON_INSTINCT")(baseContext({ postBuyMaxGainPct: 15 }))).toBe(true);
  });
  it("n'est pas attribué en dessous de 15%", () => {
    expect(spec("LE_BON_INSTINCT")(baseContext({ postBuyMaxGainPct: 14.9 }))).toBe(false);
  });
  it("n'est pas attribué sans aucun achat", () => {
    expect(spec("LE_BON_INSTINCT")(baseContext({ postBuyMaxGainPct: null }))).toBe(false);
  });
});

describe("computeMaxPostBuyGainPct", () => {
  const buyDate = new Date("2026-09-01T00:00:00Z");
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("retourne le meilleur gain % dans les 5 jours suivant l'achat", () => {
    const buys = [{ assetId: "asset-a", price: 100, createdAt: buyDate }];
    const priceHistoryByAsset = new Map([
      [
        "asset-a",
        [
          { price: 110, timestamp: new Date(buyDate.getTime() + 1 * DAY_MS) },
          { price: 120, timestamp: new Date(buyDate.getTime() + 3 * DAY_MS) },
        ],
      ],
    ]);
    expect(computeMaxPostBuyGainPct(buys, priceHistoryByAsset)).toBe(20);
  });

  it("ignore les prix au-delà de la fenêtre de 5 jours", () => {
    const buys = [{ assetId: "asset-a", price: 100, createdAt: buyDate }];
    const priceHistoryByAsset = new Map([
      ["asset-a", [{ price: 200, timestamp: new Date(buyDate.getTime() + 6 * DAY_MS) }]],
    ]);
    expect(computeMaxPostBuyGainPct(buys, priceHistoryByAsset)).toBe(null);
  });

  it("retourne null sans aucun achat", () => {
    expect(computeMaxPostBuyGainPct([], new Map())).toBe(null);
  });

  it("prend le meilleur across plusieurs achats", () => {
    const buys = [
      { assetId: "asset-a", price: 100, createdAt: buyDate },
      { assetId: "asset-b", price: 50, createdAt: buyDate },
    ];
    const priceHistoryByAsset = new Map([
      ["asset-a", [{ price: 105, timestamp: new Date(buyDate.getTime() + 1 * DAY_MS) }]],
      ["asset-b", [{ price: 60, timestamp: new Date(buyDate.getTime() + 1 * DAY_MS) }]],
    ]);
    expect(computeMaxPostBuyGainPct(buys, priceHistoryByAsset)).toBe(20);
  });
});
