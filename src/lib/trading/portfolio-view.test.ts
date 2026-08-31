import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType, PromotionStatus } from "@/generated/prisma/enums";

const dbMock = {
  user: { findUnique: vi.fn() },
  portfolio: { findUnique: vi.fn() },
  promotion: { findUnique: vi.fn() },
  transaction: { findMany: vi.fn() },
  price: { findMany: vi.fn() },
};

const refreshAssetPricesIfStaleMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/prices/pull-through", () => ({
  refreshAssetPricesIfStale: refreshAssetPricesIfStaleMock,
}));

const { getPortfolioView } = await import("./portfolio-view");

const PROMOTION_RULES = {
  minPositionSize: 1_000,
  maxPositionSize: 100_000,
  maxPositions: 20,
  maxCryptoPositions: 5,
  changeSessionsPerWeek: 1,
  maxChangesPerSession: 5,
  freezeHoursBeforeEnd: 24,
  initializationWindowHours: 48,
};

function resetMocks() {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  refreshAssetPricesIfStaleMock.mockReset();
  // Par défaut, aucun rafraîchissement : le prix vient de position.asset.prices[0] comme avant.
  refreshAssetPricesIfStaleMock.mockResolvedValue(new Map());
}

beforeEach(() => {
  resetMocks();
});

describe("getPortfolioView", () => {
  it("returns null when the user has no promotion", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: null });

    expect(await getPortfolioView("user-1")).toBeNull();
  });

  it("computes entry/actual value, allocation, daily change and portfolio totals", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.promotion.findUnique.mockResolvedValue({
      id: "promo-1",
      name: "Promotion Test",
      status: PromotionStatus.ACTIVE,
      rules: PROMOTION_RULES,
      initialCapital: 1_000_000,
    });
    dbMock.portfolio.findUnique.mockResolvedValue({
      id: "portfolio-1",
      positions: [
        {
          assetId: "asset-aapl",
          quantity: 100,
          avgEntryPrice: 150,
          openedAt: new Date("2026-01-01T00:00:00Z"),
          asset: {
            symbol: "AAPL",
            name: "Apple Inc.",
            type: AssetType.STOCK,
            logoUrl: null,
            prices: [{ price: 180 }],
          },
        },
      ],
    });
    dbMock.transaction.findMany.mockResolvedValue([{ type: "BUY", amount: 15_000 }]);
    dbMock.price.findMany.mockResolvedValue([{ assetId: "asset-aapl", price: 170 }]);

    const view = await getPortfolioView("user-1");

    expect(view).not.toBeNull();
    expect(view!.initialCapital).toBe(1_000_000);
    expect(view!.availableCash).toBe(985_000);
    expect(view!.totalMarketValue).toBe(18_000);
    expect(view!.totalValue).toBe(1_003_000);
    expect(view!.totalGainEur).toBe(3_000);
    expect(view!.totalGainPct).toBeCloseTo(0.3, 5);
    expect(view!.maxPositions).toBe(20);

    const position = view!.positions[0];
    expect(position.entryValue).toBe(15_000);
    expect(position.actualValue).toBe(18_000);
    expect(position.pnl).toBe(3_000);
    expect(position.pnlPct).toBeCloseTo(20, 5);
    expect(position.allocationPct).toBe(100);
    expect(position.dailyChangePct).toBeCloseTo(((180 - 170) / 170) * 100, 5);
    expect(position.logoUrl).toBe("https://images.financialmodelingprep.com/symbol/AAPL.png");
  });

  it("falls back to a stored logoUrl over the computed FMP URL", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.promotion.findUnique.mockResolvedValue({
      id: "promo-1",
      name: "Promotion Test",
      status: PromotionStatus.ACTIVE,
      rules: PROMOTION_RULES,
      initialCapital: 1_000_000,
    });
    dbMock.portfolio.findUnique.mockResolvedValue({
      id: "portfolio-1",
      positions: [
        {
          assetId: "asset-btc",
          quantity: 1,
          avgEntryPrice: 20_000,
          openedAt: new Date("2026-01-01T00:00:00Z"),
          asset: {
            symbol: "BTC",
            name: "Bitcoin",
            type: AssetType.CRYPTO,
            logoUrl: "https://coin-images.coingecko.com/coins/images/1/thumb/bitcoin.png",
            prices: [{ price: 25_000 }],
          },
        },
      ],
    });
    dbMock.transaction.findMany.mockResolvedValue([]);
    dbMock.price.findMany.mockResolvedValue([]);

    const view = await getPortfolioView("user-1");

    expect(view!.positions[0].logoUrl).toBe("https://coin-images.coingecko.com/coins/images/1/thumb/bitcoin.png");
    expect(view!.positions[0].dailyChangePct).toBeNull();
  });

  it("uses the freshly refreshed price over the stored one when the pull-through cache refreshed it", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.promotion.findUnique.mockResolvedValue({
      id: "promo-1",
      name: "Promotion Test",
      status: PromotionStatus.ACTIVE,
      rules: PROMOTION_RULES,
      initialCapital: 1_000_000,
    });
    dbMock.portfolio.findUnique.mockResolvedValue({
      id: "portfolio-1",
      positions: [
        {
          assetId: "asset-aapl",
          quantity: 10,
          avgEntryPrice: 150,
          openedAt: new Date("2026-01-01T00:00:00Z"),
          asset: { symbol: "AAPL", name: "Apple Inc.", type: AssetType.STOCK, logoUrl: null, prices: [{ price: 180 }] },
        },
      ],
    });
    dbMock.transaction.findMany.mockResolvedValue([]);
    dbMock.price.findMany.mockResolvedValue([]);
    refreshAssetPricesIfStaleMock.mockResolvedValue(new Map([["asset-aapl", { price: 200, timestamp: new Date(), isStale: false }]]));

    const view = await getPortfolioView("user-1");

    expect(view!.positions[0].currentPrice).toBe(200);
    expect(view!.positions[0].actualValue).toBe(2_000);
  });

  it("freezes prices at endDate and skips the refresh when the promotion is closed", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.promotion.findUnique.mockResolvedValue({
      id: "promo-1",
      name: "Promotion Test",
      status: PromotionStatus.CLOSED,
      endDate: new Date("2026-08-28T11:00:00Z"),
      rules: PROMOTION_RULES,
      initialCapital: 1_000_000,
    });
    dbMock.portfolio.findUnique.mockResolvedValue({
      id: "portfolio-1",
      positions: [
        {
          assetId: "asset-aapl",
          quantity: 100,
          avgEntryPrice: 150,
          openedAt: new Date("2026-08-06T13:00:00Z"),
          // prices[0] = cours actuel (post-clôture) : ne doit PAS être utilisé.
          asset: { symbol: "AAPL", name: "Apple Inc.", type: AssetType.STOCK, logoUrl: null, prices: [{ price: 999 }] },
        },
      ],
    });
    dbMock.transaction.findMany.mockResolvedValue([{ type: "BUY", amount: 15_000 }]);
    // Dernier cours connu ≤ endDate.
    dbMock.price.findMany.mockResolvedValue([{ assetId: "asset-aapl", price: 170 }]);

    const view = await getPortfolioView("user-1");

    expect(refreshAssetPricesIfStaleMock).toHaveBeenCalledWith([]);
    expect(dbMock.price.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetId: { in: ["asset-aapl"] }, timestamp: { lte: new Date("2026-08-28T11:00:00Z") } },
      }),
    );
    expect(view!.positions[0].currentPrice).toBe(170);
    expect(view!.positions[0].actualValue).toBe(17_000);
    expect(view!.positions[0].dailyChangePct).toBeNull();
    expect(view!.totalValue).toBe(1_002_000);
  });

  it("returns null when there is no matching portfolio", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.portfolio.findUnique.mockResolvedValue(null);
    dbMock.promotion.findUnique.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });

    expect(await getPortfolioView("user-1")).toBeNull();
  });
});
