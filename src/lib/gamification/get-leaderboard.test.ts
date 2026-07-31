import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  promotion: { findUniqueOrThrow: vi.fn() },
  portfolio: { findMany: vi.fn() },
  performanceSnapshot: { findFirst: vi.fn() },
  position: { findMany: vi.fn() },
};

const computeAvailableCashMock = vi.fn();
const refreshAssetPricesIfStaleMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/trading/execute-order", () => ({ computeAvailableCash: computeAvailableCashMock }));
vi.mock("@/lib/prices/pull-through", () => ({ refreshAssetPricesIfStale: refreshAssetPricesIfStaleMock }));

const { getLeaderboard } = await import("./get-leaderboard");

const NOW = new Date("2026-09-15T12:00:00Z");
const YESTERDAY = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

function resetMocks() {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  computeAvailableCashMock.mockReset();
  refreshAssetPricesIfStaleMock.mockReset();
  dbMock.position.findMany.mockResolvedValue([]);
  computeAvailableCashMock.mockResolvedValue(0);
  refreshAssetPricesIfStaleMock.mockResolvedValue(new Map());
}

beforeEach(() => {
  resetMocks();
});

describe("getLeaderboard", () => {
  it("classe les participants par valeur de portefeuille live et calcule l'évolution du rang depuis la veille", async () => {
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
    dbMock.portfolio.findMany.mockResolvedValue([
      { id: "portfolio-a", user: { id: "user-a", name: "Alice" } },
      { id: "portfolio-b", user: { id: "user-b", name: "Bob" } },
    ]);

    // Alice: cash + positions valent 1 100 000€ aujourd'hui (rang 1), mais 2e hier.
    // Bob: 1 050 000€ aujourd'hui (rang 2), mais 1er hier.
    computeAvailableCashMock.mockImplementation((portfolioId: string) =>
      Promise.resolve(portfolioId === "portfolio-a" ? 1_100_000 : 1_050_000),
    );
    dbMock.performanceSnapshot.findFirst.mockImplementation(
      ({ where }: { where: { portfolioId: string; timestamp: { lte: Date } } }) => {
        const isYesterday = where.timestamp.lte.getTime() === YESTERDAY.getTime();
        if (!isYesterday) return Promise.resolve(null);
        if (where.portfolioId === "portfolio-a") {
          return Promise.resolve({ totalValue: 1_020_000, cumulativeReturnPct: 2 });
        }
        return Promise.resolve({ totalValue: 1_030_000, cumulativeReturnPct: 3 });
      },
    );

    const leaderboard = await getLeaderboard("promo-1", NOW);

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]).toMatchObject({ userId: "user-a", rank: 1, rankChange: 1, totalValue: 1_100_000 });
    expect(leaderboard[1]).toMatchObject({ userId: "user-b", rank: 2, rankChange: -1, totalValue: 1_050_000 });
  });

  it("utilise le capital initial et un rendement de 0% quand aucune position n'existe encore", async () => {
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-a", user: { id: "user-a", name: "Alice" } }]);
    computeAvailableCashMock.mockResolvedValue(1_000_000);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);

    const leaderboard = await getLeaderboard("promo-1", NOW);

    expect(leaderboard[0]).toMatchObject({
      totalValue: 1_000_000,
      cumulativeReturnPct: 0,
      rank: 1,
      rankChange: 0,
      weeklyReturnPct: null,
      bestPosition: null,
      worstPosition: null,
    });
  });

  it("calcule la valeur live et la meilleure/pire position à partir des positions ouvertes rafraîchies", async () => {
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-a", user: { id: "user-a", name: "Alice" } }]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);
    computeAvailableCashMock.mockResolvedValue(500_000);
    dbMock.position.findMany.mockResolvedValue([
      {
        portfolioId: "portfolio-a",
        assetId: "asset-aapl",
        quantity: 10,
        avgEntryPrice: 100,
        asset: { id: "asset-aapl", symbol: "AAPL", name: "Apple Inc.", prices: [{ price: 120 }] },
      },
      {
        portfolioId: "portfolio-a",
        assetId: "asset-tsla",
        quantity: 5,
        avgEntryPrice: 100,
        asset: { id: "asset-tsla", symbol: "TSLA", name: "Tesla Inc.", prices: [{ price: 80 }] },
      },
    ]);

    const leaderboard = await getLeaderboard("promo-1", NOW);

    // 500_000 cash + (10*120) + (5*80) = 500_000 + 1_200 + 400 = 501_600
    expect(leaderboard[0].totalValue).toBe(501_600);
    expect(leaderboard[0].bestPosition).toMatchObject({ symbol: "AAPL", pnlPct: 20 });
    expect(leaderboard[0].worstPosition).toMatchObject({ symbol: "TSLA", pnlPct: -20 });
  });

  it("utilise le prix rafraîchi par le cache pull-through plutôt que le prix stocké", async () => {
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-a", user: { id: "user-a", name: "Alice" } }]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);
    computeAvailableCashMock.mockResolvedValue(0);
    dbMock.position.findMany.mockResolvedValue([
      {
        portfolioId: "portfolio-a",
        assetId: "asset-aapl",
        quantity: 10,
        avgEntryPrice: 100,
        asset: { id: "asset-aapl", symbol: "AAPL", name: "Apple Inc.", prices: [{ price: 120 }] },
      },
    ]);
    refreshAssetPricesIfStaleMock.mockResolvedValue(
      new Map([["asset-aapl", { price: 150, timestamp: NOW, isStale: false }]]),
    );

    const leaderboard = await getLeaderboard("promo-1", NOW);

    expect(leaderboard[0].totalValue).toBe(1_500);
    expect(leaderboard[0].bestPosition?.pnlPct).toBeCloseTo(50, 5);
  });
});
