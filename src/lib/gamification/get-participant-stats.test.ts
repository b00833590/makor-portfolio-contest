import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType, TransactionType } from "@/generated/prisma/enums";

const dbMock = {
  position: { findMany: vi.fn() },
  transaction: { findMany: vi.fn(), count: vi.fn() },
  performanceSnapshot: { findMany: vi.fn() },
};

const refreshAssetPricesIfStaleMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/prices/pull-through", () => ({ refreshAssetPricesIfStale: refreshAssetPricesIfStaleMock }));

const { getParticipantStats } = await import("./get-participant-stats");

const leaderboardRow = {
  cumulativeReturnPct: 5,
  weeklyReturnPct: 2,
  bestPosition: { symbol: "AAPL", name: "Apple Inc.", pnlPct: 20 },
  worstPosition: { symbol: "TSLA", name: "Tesla Inc.", pnlPct: -10 },
};

beforeEach(() => {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  refreshAssetPricesIfStaleMock.mockReset();
  refreshAssetPricesIfStaleMock.mockResolvedValue(new Map());
  dbMock.transaction.count.mockResolvedValue(0);
  dbMock.transaction.findMany.mockResolvedValue([]);
  dbMock.performanceSnapshot.findMany.mockResolvedValue([]);
  dbMock.position.findMany.mockResolvedValue([]);
});

describe("getParticipantStats", () => {
  it("carries best/worst position and cumulative/weekly return through from the leaderboard row", async () => {
    const stats = await getParticipantStats("portfolio-1", leaderboardRow);

    expect(stats.bestPosition).toEqual(leaderboardRow.bestPosition);
    expect(stats.worstPosition).toEqual(leaderboardRow.worstPosition);
    expect(stats.cumulativeReturnPct).toBe(5);
    expect(stats.weeklyReturnPct).toBe(2);
  });

  it("computes unrealized gain and win rate from open and closed positions", async () => {
    dbMock.position.findMany.mockResolvedValue([
      {
        id: "pos-open",
        assetId: "aapl",
        avgEntryPrice: 100,
        quantity: 10,
        openedAt: new Date("2026-01-01"),
        closedAt: null,
        asset: { symbol: "AAPL", sector: "Technology", type: AssetType.STOCK, prices: [{ price: 100 }] },
      },
      {
        id: "pos-closed",
        assetId: "tsla",
        avgEntryPrice: 200,
        quantity: 0,
        openedAt: new Date("2026-01-01"),
        closedAt: new Date("2026-01-05"),
        asset: { symbol: "TSLA", sector: "Automotive", type: AssetType.STOCK, prices: [] },
      },
    ]);
    dbMock.transaction.findMany.mockResolvedValue([
      { assetId: "tsla", type: TransactionType.SELL_FULL, price: 150, quantity: 5, createdAt: new Date("2026-01-05") },
    ]);
    dbMock.transaction.count.mockResolvedValue(3);
    refreshAssetPricesIfStaleMock.mockResolvedValue(new Map([["aapl", { price: 120, timestamp: new Date(), isStale: false }]]));

    const stats = await getParticipantStats("portfolio-1", leaderboardRow);

    // Open AAPL: cost 1000, value 1200 -> +200. Closed TSLA: cost 1000, exit 750 -> -250.
    expect(stats.unrealizedGainEur).toBe(200);
    expect(stats.winRatePct).toBe(50);
    expect(stats.avgGainPerWinningTradeEur).toBe(200);
    expect(stats.avgLossPerLosingTradeEur).toBe(-250);
    expect(stats.transactionCount).toBe(3);
  });

  it("computes sector and asset-class allocation from open positions weighted by market value", async () => {
    dbMock.position.findMany.mockResolvedValue([
      {
        id: "pos-1",
        assetId: "aapl",
        avgEntryPrice: 100,
        quantity: 10,
        openedAt: new Date("2026-01-01"),
        closedAt: null,
        asset: { symbol: "AAPL", sector: "Technology", type: AssetType.STOCK, prices: [{ price: 100 }] },
      },
      {
        id: "pos-2",
        assetId: "btc",
        avgEntryPrice: 100,
        quantity: 10,
        openedAt: new Date("2026-01-01"),
        closedAt: null,
        asset: { symbol: "BTC", sector: null, type: AssetType.CRYPTO, prices: [{ price: 100 }] },
      },
    ]);

    const stats = await getParticipantStats("portfolio-1", leaderboardRow);

    expect(stats.sectorAllocation).toEqual(
      expect.arrayContaining([
        { key: "Technology", valuePct: 50 },
        { key: "Non renseigné", valuePct: 50 },
      ]),
    );
    expect(stats.assetClassAllocation).toEqual(
      expect.arrayContaining([
        { key: AssetType.STOCK, valuePct: 50 },
        { key: AssetType.CRYPTO, valuePct: 50 },
      ]),
    );
  });

  it("returns null volatility and win rate when there is no history yet", async () => {
    const stats = await getParticipantStats("portfolio-1", leaderboardRow);

    expect(stats.volatilityPct).toBeNull();
    expect(stats.winRatePct).toBeNull();
    expect(stats.dailyReturnPct).toBeNull();
    expect(stats.avgPositionPerformancePct).toBeNull();
  });

  it("computes volatility as the sample standard deviation of daily returns", async () => {
    dbMock.performanceSnapshot.findMany.mockResolvedValue([
      { dailyReturnPct: 1 },
      { dailyReturnPct: 3 },
      { dailyReturnPct: -2 },
    ]);

    const stats = await getParticipantStats("portfolio-1", leaderboardRow);

    // mean = 2/3, sample variance = ((1-2/3)^2+(3-2/3)^2+(-2-2/3)^2)/2
    expect(stats.volatilityPct).toBeCloseTo(2.5166, 3);
    expect(stats.dailyReturnPct).toBe(-2);
  });
});
