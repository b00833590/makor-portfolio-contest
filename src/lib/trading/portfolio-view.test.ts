import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType, PromotionStatus } from "@/generated/prisma/enums";
import type { PromotionValuation, ValuedPortfolio, ValuedPosition } from "./promotion-valuation";

const dbMock = {
  user: { findUnique: vi.fn() },
  portfolio: { findUnique: vi.fn() },
  promotion: { findUnique: vi.fn() },
  price: { findMany: vi.fn() },
};

const computeAvailableCashMock = vi.fn();
const getPromotionValuationMock = vi.fn();
const getCachedPromotionValuationMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("./execute-order", () => ({ computeAvailableCash: computeAvailableCashMock }));
vi.mock("./promotion-valuation", () => ({
  getPromotionValuation: getPromotionValuationMock,
  getCachedPromotionValuation: getCachedPromotionValuationMock,
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

function position(overrides: Partial<ValuedPosition> & { assetId: string }): ValuedPosition {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    assetType: AssetType.STOCK,
    logoUrl: null,
    openedAt: "2026-01-01T00:00:00.000Z",
    quantity: 1,
    avgEntryPrice: 100,
    currentPrice: 100,
    marketValue: 100,
    pnlPct: 0,
    ...overrides,
  };
}

function valuation(portfolio: Partial<ValuedPortfolio>): PromotionValuation {
  const valued: ValuedPortfolio = {
    portfolioId: "portfolio-1",
    userId: "user-1",
    availableCash: 0,
    marketValue: 0,
    totalValue: 1_000_000,
    cumulativeReturnPct: 0,
    positions: [],
    ...portfolio,
  };
  return { promotionId: "promo-1", initialCapital: 1_000_000, pricesByAsset: {}, byPortfolio: { "portfolio-1": valued } };
}

beforeEach(() => {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  computeAvailableCashMock.mockReset();
  getPromotionValuationMock.mockReset();
  getCachedPromotionValuationMock.mockReset();
  dbMock.price.findMany.mockResolvedValue([]);
});

describe("getPortfolioView", () => {
  it("returns null when the user has no promotion", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: null });
    expect(await getPortfolioView("user-1")).toBeNull();
  });

  it("returns null when there is no matching portfolio", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.portfolio.findUnique.mockResolvedValue(null);
    dbMock.promotion.findUnique.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
    expect(await getPortfolioView("user-1")).toBeNull();
  });

  it("derives entry/actual value, allocation, daily change and totals from the shared valuation", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.promotion.findUnique.mockResolvedValue({
      id: "promo-1",
      name: "Promotion Test",
      status: PromotionStatus.ACTIVE,
      rules: PROMOTION_RULES,
      initialCapital: 1_000_000,
    });
    dbMock.portfolio.findUnique.mockResolvedValue({ id: "portfolio-1" });
    getCachedPromotionValuationMock.mockResolvedValue(
      valuation({
        availableCash: 985_000,
        marketValue: 18_000,
        totalValue: 1_003_000,
        cumulativeReturnPct: 0.3,
        positions: [
          position({
            assetId: "asset-aapl",
            symbol: "AAPL",
            logoUrl: "https://images.financialmodelingprep.com/symbol/AAPL.png",
            quantity: 100,
            avgEntryPrice: 150,
            currentPrice: 180,
            marketValue: 18_000,
            pnlPct: 20,
          }),
        ],
      }),
    );
    dbMock.price.findMany.mockResolvedValue([{ assetId: "asset-aapl", price: 170 }]);

    const view = await getPortfolioView("user-1");

    expect(view!.availableCash).toBe(985_000);
    expect(view!.totalMarketValue).toBe(18_000);
    expect(view!.totalValue).toBe(1_003_000);
    expect(view!.totalGainEur).toBe(3_000);
    expect(view!.totalGainPct).toBeCloseTo(0.3, 5);
    expect(view!.maxPositions).toBe(20);

    const p = view!.positions[0];
    expect(p.entryValue).toBe(15_000);
    expect(p.actualValue).toBe(18_000);
    expect(p.pnl).toBe(3_000);
    expect(p.pnlPct).toBeCloseTo(20, 5);
    expect(p.allocationPct).toBe(100);
    expect(p.dailyChangePct).toBeCloseTo(((180 - 170) / 170) * 100, 5);
  });

  it("aligns totalGainPct with the shared valuation's cumulative return (same as the leaderboard row)", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.promotion.findUnique.mockResolvedValue({
      id: "promo-1",
      name: "P",
      status: PromotionStatus.ACTIVE,
      rules: PROMOTION_RULES,
      initialCapital: 1_000_000,
    });
    dbMock.portfolio.findUnique.mockResolvedValue({ id: "portfolio-1" });
    getCachedPromotionValuationMock.mockResolvedValue(
      valuation({ availableCash: 0, marketValue: 1_000_000.0009, totalValue: 1_000_000.0009, cumulativeReturnPct: 0.00000009 }),
    );

    const view = await getPortfolioView("user-1");

    expect(view!.totalValue).toBe(1_000_000.0009);
    expect(view!.totalGainPct).toBeCloseTo(((1_000_000.0009 - 1_000_000) / 1_000_000) * 100, 12);
  });

  it("uses a frozen valuation and no daily-change lookup when the promotion is closed", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.promotion.findUnique.mockResolvedValue({
      id: "promo-1",
      name: "Promotion Test",
      status: PromotionStatus.CLOSED,
      endDate: new Date("2026-08-28T11:00:00Z"),
      rules: PROMOTION_RULES,
      initialCapital: 1_000_000,
    });
    dbMock.portfolio.findUnique.mockResolvedValue({ id: "portfolio-1" });
    getPromotionValuationMock.mockResolvedValue(
      valuation({
        availableCash: 985_000,
        marketValue: 17_000,
        totalValue: 1_002_000,
        positions: [
          position({ assetId: "asset-aapl", quantity: 100, avgEntryPrice: 150, currentPrice: 170, marketValue: 17_000 }),
        ],
      }),
    );

    const view = await getPortfolioView("user-1");

    expect(getPromotionValuationMock).toHaveBeenCalledWith("promo-1", new Date("2026-08-28T11:00:00Z"), { frozen: true });
    expect(getCachedPromotionValuationMock).not.toHaveBeenCalled();
    expect(dbMock.price.findMany).not.toHaveBeenCalled();
    expect(view!.totalValue).toBe(1_002_000);
    expect(view!.positions[0].currentPrice).toBe(170);
    expect(view!.positions[0].dailyChangePct).toBeNull();
  });

  it("falls back to computeAvailableCash when the valuation does not yet know the portfolio", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1" });
    dbMock.promotion.findUnique.mockResolvedValue({
      id: "promo-1",
      name: "P",
      status: PromotionStatus.ACTIVE,
      rules: PROMOTION_RULES,
      initialCapital: 1_000_000,
    });
    dbMock.portfolio.findUnique.mockResolvedValue({ id: "portfolio-1" });
    getCachedPromotionValuationMock.mockResolvedValue({
      promotionId: "promo-1",
      initialCapital: 1_000_000,
      pricesByAsset: {},
      byPortfolio: {}, // portefeuille absent (vient d'être créé)
    });
    computeAvailableCashMock.mockResolvedValue(1_000_000);

    const view = await getPortfolioView("user-1");

    expect(computeAvailableCashMock).toHaveBeenCalledWith("portfolio-1", 1_000_000);
    expect(view!.availableCash).toBe(1_000_000);
    expect(view!.totalValue).toBe(1_000_000);
    expect(view!.positions).toEqual([]);
  });
});
