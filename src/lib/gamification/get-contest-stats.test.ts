import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType, TransactionType } from "@/generated/prisma/enums";
import type { LeaderboardRow } from "./get-leaderboard";

const dbMock = {
  portfolio: { findMany: vi.fn() },
};
const getCachedPromotionValuationMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/trading/promotion-valuation", () => ({ getCachedPromotionValuation: getCachedPromotionValuationMock }));

const { getContestStats } = await import("./get-contest-stats");

function makeRow(overrides: Partial<LeaderboardRow>): LeaderboardRow {
  return {
    userId: "user",
    name: "User",
    avatarUrl: null,
    portfolioId: "portfolio",
    totalValue: 1_000_000,
    cumulativeReturnPct: 0,
    rank: 1,
    previousRank: null,
    rankChange: 0,
    weeklyReturnPct: null,
    bestPosition: null,
    worstPosition: null,
    ...overrides,
  };
}

beforeEach(() => {
  dbMock.portfolio.findMany.mockReset();
  getCachedPromotionValuationMock.mockReset();
  getCachedPromotionValuationMock.mockResolvedValue({ promotionId: "promo-1", initialCapital: 1_000_000, pricesByAsset: {}, byPortfolio: {} });
});

describe("getContestStats", () => {
  it("returns nulls and zero counts for a promotion with no portfolios", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([]);

    const stats = await getContestStats("promo-1", []);

    expect(stats.mostHeldAsset).toBeNull();
    expect(stats.bestPerformingAsset).toBeNull();
    expect(stats.bestTrade).toBeNull();
    expect(stats.bestContestDay).toBeNull();
    expect(stats.totalTransactionCount).toBe(0);
    expect(stats.sectorAllocation).toEqual([]);
  });

  it("finds the most-held asset by participant count and the best/worst performing asset", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([
      {
        user: { name: "Alice" },
        positions: [
          {
            id: "p1",
            assetId: "aapl",
            avgEntryPrice: 100,
            quantity: 10,
            openedAt: new Date("2026-01-01"),
            closedAt: null,
            asset: { symbol: "AAPL", name: "Apple", sector: "Technology", type: AssetType.STOCK, prices: [{ price: 120 }] },
          },
        ],
        transactions: [],
        snapshots: [],
      },
      {
        user: { name: "Bob" },
        positions: [
          {
            id: "p2",
            assetId: "aapl",
            avgEntryPrice: 100,
            quantity: 5,
            openedAt: new Date("2026-01-01"),
            closedAt: null,
            asset: { symbol: "AAPL", name: "Apple", sector: "Technology", type: AssetType.STOCK, prices: [{ price: 120 }] },
          },
          {
            id: "p3",
            assetId: "tsla",
            avgEntryPrice: 200,
            quantity: 2,
            openedAt: new Date("2026-01-01"),
            closedAt: null,
            asset: { symbol: "TSLA", name: "Tesla", sector: "Automotive", type: AssetType.STOCK, prices: [{ price: 150 }] },
          },
        ],
        transactions: [],
        snapshots: [],
      },
    ]);

    const stats = await getContestStats("promo-1", []);

    expect(stats.mostHeldAsset).toMatchObject({ symbol: "AAPL", participantCount: 2 });
    expect(stats.bestPerformingAsset).toMatchObject({ symbol: "AAPL", avgPnlPct: 20 });
    expect(stats.worstPerformingAsset).toMatchObject({ symbol: "TSLA", avgPnlPct: -25 });
  });

  it("picks the single best trade across all participants", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([
      {
        user: { name: "Alice" },
        positions: [
          {
            id: "p1",
            assetId: "aapl",
            avgEntryPrice: 100,
            quantity: 0,
            openedAt: new Date("2026-01-01"),
            closedAt: new Date("2026-01-05"),
            asset: { symbol: "AAPL", name: "Apple", sector: "Technology", type: AssetType.STOCK, prices: [] },
          },
        ],
        transactions: [
          { assetId: "aapl", type: TransactionType.SELL_FULL, price: 300, quantity: 10, createdAt: new Date("2026-01-05") },
        ],
        snapshots: [],
      },
      {
        user: { name: "Bob" },
        positions: [
          {
            id: "p2",
            assetId: "tsla",
            avgEntryPrice: 200,
            quantity: 0,
            openedAt: new Date("2026-01-01"),
            closedAt: new Date("2026-01-05"),
            asset: { symbol: "TSLA", name: "Tesla", sector: "Automotive", type: AssetType.STOCK, prices: [] },
          },
        ],
        transactions: [
          { assetId: "tsla", type: TransactionType.SELL_FULL, price: 210, quantity: 5, createdAt: new Date("2026-01-05") },
        ],
        snapshots: [],
      },
    ]);

    const stats = await getContestStats("promo-1", []);

    expect(stats.bestTrade).toMatchObject({ participantName: "Alice", symbol: "AAPL", pnlEur: 2000 });
    expect(stats.totalTransactionCount).toBe(2);
  });

  it("finds the best single contest day across all portfolios", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([
      {
        user: { name: "Alice" },
        positions: [],
        transactions: [],
        snapshots: [{ timestamp: new Date("2026-01-10T00:00:00Z"), dailyReturnPct: 3 }],
      },
      {
        user: { name: "Bob" },
        positions: [],
        transactions: [],
        snapshots: [{ timestamp: new Date("2026-01-11T00:00:00Z"), dailyReturnPct: 8 }],
      },
    ]);

    const stats = await getContestStats("promo-1", []);

    expect(stats.bestContestDay).toEqual({ participantName: "Bob", date: "2026-01-11", dailyReturnPct: 8 });
  });

  it("derives biggest rank gain/drop and best weekly return from the leaderboard rows", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([]);
    const leaderboard = [
      makeRow({ name: "Alice", rankChange: 3, weeklyReturnPct: 10 }),
      makeRow({ name: "Bob", rankChange: -5, weeklyReturnPct: 2 }),
      makeRow({ name: "Carla", rankChange: 0, weeklyReturnPct: null }),
    ];

    const stats = await getContestStats("promo-1", leaderboard);

    expect(stats.biggestRankGain).toEqual({ participantName: "Alice", rankChange: 3 });
    expect(stats.biggestRankDrop).toEqual({ participantName: "Bob", rankChange: -5 });
    expect(stats.bestWeeklyReturn).toEqual({ participantName: "Alice", weeklyReturnPct: 10 });
  });
});
