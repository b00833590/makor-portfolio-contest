import { describe, it, expect } from "vitest";
import { tradingBadges, computeHasSuccessfulArbitrage } from "./trading";
import { baseContext, NOW } from "./badge-test-context";

function spec(code: string) {
  const found = tradingBadges.find((badge) => badge.code === code);
  if (!found?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return found.evaluate;
}

describe("PREMIER_PAS", () => {
  it("est attribué dès la première transaction", () => {
    expect(spec("PREMIER_PAS")(baseContext({ transactionCount: 1 }))).toBe(true);
  });
  it("n'est pas attribué sans transaction", () => {
    expect(spec("PREMIER_PAS")(baseContext({ transactionCount: 0 }))).toBe(false);
  });
});

describe("ARBITRAGISTE", () => {
  it("est attribué si un arbitrage réussi a été détecté", () => {
    expect(spec("ARBITRAGISTE")(baseContext({ hasSuccessfulArbitrage: true }))).toBe(true);
  });
  it("n'est pas attribué sinon", () => {
    expect(spec("ARBITRAGISTE")(baseContext({ hasSuccessfulArbitrage: false }))).toBe(false);
  });
});

describe("PREMIERE_VICTOIRE", () => {
  it("est attribué dès qu'une vente est gagnante", () => {
    const ctx = baseContext({ closedTradesChronological: [{ pnlEur: 10, pnlPct: 5, closedAt: NOW }] });
    expect(spec("PREMIERE_VICTOIRE")(ctx)).toBe(true);
  });
  it("n'est pas attribué si toutes les ventes sont perdantes", () => {
    const ctx = baseContext({ closedTradesChronological: [{ pnlEur: -10, pnlPct: -5, closedAt: NOW }] });
    expect(spec("PREMIERE_VICTOIRE")(ctx)).toBe(false);
  });
});

describe("COUP_DOUBLE", () => {
  it("est attribué pour une vente à plus de 10% de gain", () => {
    const ctx = baseContext({ closedTradesChronological: [{ pnlEur: 100, pnlPct: 10.1, closedAt: NOW }] });
    expect(spec("COUP_DOUBLE")(ctx)).toBe(true);
  });
  it("n'est pas attribué à exactement 10%", () => {
    const ctx = baseContext({ closedTradesChronological: [{ pnlEur: 100, pnlPct: 10, closedAt: NOW }] });
    expect(spec("COUP_DOUBLE")(ctx)).toBe(false);
  });
});

describe("MAIN_CHAUDE", () => {
  it("est attribué pour 5 ventes gagnantes consécutives", () => {
    const trades = Array.from({ length: 5 }, () => ({ pnlEur: 10, pnlPct: 5, closedAt: NOW }));
    expect(spec("MAIN_CHAUDE")(baseContext({ closedTradesChronological: trades }))).toBe(true);
  });
  it("n'est pas attribué si une perte casse la série la plus récente", () => {
    const trades = [
      { pnlEur: 10, pnlPct: 5, closedAt: NOW },
      { pnlEur: -10, pnlPct: -5, closedAt: NOW },
      { pnlEur: 10, pnlPct: 5, closedAt: NOW },
      { pnlEur: 10, pnlPct: 5, closedAt: NOW },
      { pnlEur: 10, pnlPct: 5, closedAt: NOW },
    ];
    expect(spec("MAIN_CHAUDE")(baseContext({ closedTradesChronological: trades }))).toBe(false);
  });
  it("n'est pas attribué avec moins de 5 ventes", () => {
    const trades = Array.from({ length: 4 }, () => ({ pnlEur: 10, pnlPct: 5, closedAt: NOW }));
    expect(spec("MAIN_CHAUDE")(baseContext({ closedTradesChronological: trades }))).toBe(false);
  });
});

describe("computeHasSuccessfulArbitrage", () => {
  it("est vrai pour une vente puis un achat d'un autre actif, aujourd'hui gagnant, dans la même session", () => {
    const transactions = [
      { type: "SELL_FULL", assetId: "asset-a", changeSessionId: "session-1" },
      { type: "BUY", assetId: "asset-b", changeSessionId: "session-1" },
    ] as const;
    const currentPnlPctByAsset = new Map([["asset-b", 5]]);
    expect(computeHasSuccessfulArbitrage([...transactions], currentPnlPctByAsset)).toBe(true);
  });

  it("est faux si l'actif racheté est en perte", () => {
    const transactions = [
      { type: "SELL_FULL", assetId: "asset-a", changeSessionId: "session-1" },
      { type: "BUY", assetId: "asset-b", changeSessionId: "session-1" },
    ] as const;
    const currentPnlPctByAsset = new Map([["asset-b", -2]]);
    expect(computeHasSuccessfulArbitrage([...transactions], currentPnlPctByAsset)).toBe(false);
  });

  it("est faux si le rachat concerne le même actif que celui vendu", () => {
    const transactions = [
      { type: "SELL_PARTIAL", assetId: "asset-a", changeSessionId: "session-1" },
      { type: "BUY", assetId: "asset-a", changeSessionId: "session-1" },
    ] as const;
    const currentPnlPctByAsset = new Map([["asset-a", 5]]);
    expect(computeHasSuccessfulArbitrage([...transactions], currentPnlPctByAsset)).toBe(false);
  });

  it("est faux si la vente et l'achat ne sont pas dans la même session", () => {
    const transactions = [
      { type: "SELL_FULL", assetId: "asset-a", changeSessionId: "session-1" },
      { type: "BUY", assetId: "asset-b", changeSessionId: "session-2" },
    ] as const;
    const currentPnlPctByAsset = new Map([["asset-b", 5]]);
    expect(computeHasSuccessfulArbitrage([...transactions], currentPnlPctByAsset)).toBe(false);
  });

  it("ignore les transactions hors session de changement", () => {
    const transactions = [
      { type: "SELL_FULL", assetId: "asset-a", changeSessionId: null },
      { type: "BUY", assetId: "asset-b", changeSessionId: null },
    ] as const;
    const currentPnlPctByAsset = new Map([["asset-b", 5]]);
    expect(computeHasSuccessfulArbitrage([...transactions], currentPnlPctByAsset)).toBe(false);
  });
});
