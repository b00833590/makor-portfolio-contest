import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  promotion: { findUniqueOrThrow: vi.fn() },
  portfolio: { findMany: vi.fn() },
  position: { findMany: vi.fn() },
  price: { findMany: vi.fn() },
};
const computeAvailableCashMock = vi.fn();
const refreshAssetPricesIfStaleMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/trading/execute-order", () => ({ computeAvailableCash: computeAvailableCashMock }));
vi.mock("@/lib/prices/pull-through", () => ({ refreshAssetPricesIfStale: refreshAssetPricesIfStaleMock }));

const { getPromotionValuation } = await import("./promotion-valuation");

const NOW = new Date("2026-09-15T12:00:00Z");

beforeEach(() => {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  computeAvailableCashMock.mockReset();
  refreshAssetPricesIfStaleMock.mockReset();
  dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
  dbMock.price.findMany.mockResolvedValue([]);
  refreshAssetPricesIfStaleMock.mockResolvedValue(new Map());
});

describe("getPromotionValuation", () => {
  it("valorise chaque portefeuille = cash + Σ(quantité × cours rafraîchi)", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([
      { id: "pf-a", userId: "u-a" },
      { id: "pf-b", userId: "u-b" },
    ]);
    computeAvailableCashMock.mockImplementation((id: string) => Promise.resolve(id === "pf-a" ? 500_000 : 1_000_000));
    dbMock.position.findMany.mockResolvedValue([
      {
        portfolioId: "pf-a",
        assetId: "aapl",
        quantity: 10,
        avgEntryPrice: 100,
        openedAt: new Date("2026-09-01T00:00:00Z"),
        asset: { id: "aapl", symbol: "AAPL", name: "Apple", type: "STOCK", logoUrl: null, prices: [{ price: 120 }] },
      },
    ]);
    refreshAssetPricesIfStaleMock.mockResolvedValue(new Map([["aapl", { price: 150, timestamp: NOW, isStale: false }]]));

    const v = await getPromotionValuation("promo-1", NOW);

    // pf-a : 500_000 cash + 10 × 150 (cours rafraîchi, pas le 120 stocké) = 501_500
    expect(v.byPortfolio["pf-a"].totalValue).toBe(501_500);
    expect(v.byPortfolio["pf-a"].marketValue).toBe(1_500);
    expect(v.byPortfolio["pf-a"].cumulativeReturnPct).toBeCloseTo((501_500 - 1_000_000) / 1_000_000 * 100, 6);
    expect(v.byPortfolio["pf-a"].positions[0]).toMatchObject({ symbol: "AAPL", currentPrice: 150, pnlPct: 50 });
    expect(v.pricesByAsset).toEqual({ aapl: 150 });

    // pf-b : aucune position -> cash seul
    expect(v.byPortfolio["pf-b"].totalValue).toBe(1_000_000);
    expect(v.byPortfolio["pf-b"].positions).toEqual([]);
  });

  it("en mode figé, valorise au dernier cours ≤ asOf sans appeler le fournisseur", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "pf-a", userId: "u-a" }]);
    computeAvailableCashMock.mockResolvedValue(0);
    dbMock.position.findMany.mockResolvedValue([
      {
        portfolioId: "pf-a",
        assetId: "aapl",
        quantity: 10,
        avgEntryPrice: 100,
        openedAt: new Date("2026-09-01T00:00:00Z"),
        asset: { id: "aapl", symbol: "AAPL", name: "Apple", type: "STOCK", logoUrl: null, prices: [{ price: 999 }] },
      },
    ]);
    dbMock.price.findMany.mockResolvedValue([{ assetId: "aapl", price: 120 }]);

    const v = await getPromotionValuation("promo-1", NOW, { frozen: true });

    expect(refreshAssetPricesIfStaleMock).not.toHaveBeenCalled();
    expect(v.byPortfolio["pf-a"].totalValue).toBe(1_200);
  });

  it("retombe sur le prix d'entrée quand aucun cours n'est disponible", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "pf-a", userId: "u-a" }]);
    computeAvailableCashMock.mockResolvedValue(0);
    dbMock.position.findMany.mockResolvedValue([
      {
        portfolioId: "pf-a",
        assetId: "x",
        quantity: 4,
        avgEntryPrice: 250,
        openedAt: new Date("2026-09-01T00:00:00Z"),
        asset: { id: "x", symbol: "X", name: "X", type: "STOCK", logoUrl: null, prices: [] },
      },
    ]);

    const v = await getPromotionValuation("promo-1", NOW);

    expect(v.byPortfolio["pf-a"].totalValue).toBe(1_000);
    expect(v.byPortfolio["pf-a"].positions[0].currentPrice).toBe(250);
  });
});
