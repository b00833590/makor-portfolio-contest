import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PromotionValuation, ValuedPortfolio } from "@/lib/trading/promotion-valuation";

const dbMock = {
  portfolio: { findMany: vi.fn() },
  performanceSnapshot: { findFirst: vi.fn() },
  user: { findMany: vi.fn() },
};

const getPromotionValuationMock = vi.fn();
const getCachedPromotionValuationMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/trading/promotion-valuation", () => ({
  getPromotionValuation: getPromotionValuationMock,
  getCachedPromotionValuation: getCachedPromotionValuationMock,
}));

const { getLeaderboard } = await import("./get-leaderboard");

const NOW = new Date("2026-09-15T12:00:00Z");
const YESTERDAY = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

function valued(overrides: Partial<ValuedPortfolio> & { portfolioId: string; userId: string }): ValuedPortfolio {
  return {
    availableCash: 0,
    marketValue: 0,
    totalValue: 1_000_000,
    cumulativeReturnPct: 0,
    positions: [],
    ...overrides,
  };
}

function valuation(portfolios: ValuedPortfolio[], initialCapital = 1_000_000): PromotionValuation {
  return {
    promotionId: "promo-1",
    initialCapital,
    pricesByAsset: {},
    byPortfolio: Object.fromEntries(portfolios.map((p) => [p.portfolioId, p])),
  };
}

beforeEach(() => {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  getPromotionValuationMock.mockReset();
  getCachedPromotionValuationMock.mockReset();
  dbMock.user.findMany.mockResolvedValue([]);
  dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);
});

describe("getLeaderboard", () => {
  it("classe les participants par valeur de portefeuille et calcule l'évolution du rang depuis la veille", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([
      { id: "portfolio-a", user: { id: "user-a", name: "Alice" } },
      { id: "portfolio-b", user: { id: "user-b", name: "Bob" } },
    ]);
    getCachedPromotionValuationMock.mockResolvedValue(
      valuation([
        valued({ portfolioId: "portfolio-a", userId: "user-a", totalValue: 1_100_000, cumulativeReturnPct: 10 }),
        valued({ portfolioId: "portfolio-b", userId: "user-b", totalValue: 1_050_000, cumulativeReturnPct: 5 }),
      ]),
    );
    // Alice 2e hier, Bob 1er hier.
    dbMock.performanceSnapshot.findFirst.mockImplementation(
      ({ where }: { where: { portfolioId: string; timestamp: { lte: Date } } }) => {
        if (where.timestamp.lte.getTime() !== YESTERDAY.getTime()) return Promise.resolve(null);
        return Promise.resolve({
          totalValue: where.portfolioId === "portfolio-a" ? 1_020_000 : 1_030_000,
          cumulativeReturnPct: where.portfolioId === "portfolio-a" ? 2 : 3,
        });
      },
    );

    const leaderboard = await getLeaderboard("promo-1", NOW);

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]).toMatchObject({ userId: "user-a", rank: 1, rankChange: 1, totalValue: 1_100_000 });
    expect(leaderboard[1]).toMatchObject({ userId: "user-b", rank: 2, rankChange: -1, totalValue: 1_050_000 });
  });

  it("retombe sur le capital initial et un rendement de 0% quand la valorisation ne connaît pas le portefeuille", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-a", user: { id: "user-a", name: "Alice" } }]);
    getCachedPromotionValuationMock.mockResolvedValue(valuation([]));

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

  it("reporte la meilleure et la pire position depuis la valorisation partagée", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-a", user: { id: "user-a", name: "Alice" } }]);
    getCachedPromotionValuationMock.mockResolvedValue(
      valuation([
        valued({
          portfolioId: "portfolio-a",
          userId: "user-a",
          totalValue: 501_600,
          cumulativeReturnPct: -49.84,
          positions: [
            { assetId: "a", symbol: "AAPL", name: "Apple Inc.", assetType: "STOCK", logoUrl: null, openedAt: "2026-09-01T00:00:00.000Z", quantity: 10, avgEntryPrice: 100, currentPrice: 120, marketValue: 1_200, pnlPct: 20 },
            { assetId: "t", symbol: "TSLA", name: "Tesla Inc.", assetType: "STOCK", logoUrl: null, openedAt: "2026-09-01T00:00:00.000Z", quantity: 5, avgEntryPrice: 100, currentPrice: 80, marketValue: 400, pnlPct: -20 },
          ],
        }),
      ]),
    );

    const leaderboard = await getLeaderboard("promo-1", NOW);

    expect(leaderboard[0].totalValue).toBe(501_600);
    expect(leaderboard[0].bestPosition).toEqual({ symbol: "AAPL", name: "Apple Inc.", pnlPct: 20 });
    expect(leaderboard[0].worstPosition).toEqual({ symbol: "TSLA", name: "Tesla Inc.", pnlPct: -20 });
  });

  it("renvoie la photo de profil de tous les participants, pas seulement du podium", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([
      { id: "portfolio-a", user: { id: "user-a", name: "Alice" } },
      { id: "portfolio-b", user: { id: "user-b", name: "Bob" } },
      { id: "portfolio-c", user: { id: "user-c", name: "Carol" } },
      { id: "portfolio-d", user: { id: "user-d", name: "Dan" } },
    ]);
    getCachedPromotionValuationMock.mockResolvedValue(
      valuation([
        valued({ portfolioId: "portfolio-a", userId: "user-a", totalValue: 1_400_000, cumulativeReturnPct: 40 }),
        valued({ portfolioId: "portfolio-b", userId: "user-b", totalValue: 1_300_000, cumulativeReturnPct: 30 }),
        valued({ portfolioId: "portfolio-c", userId: "user-c", totalValue: 1_200_000, cumulativeReturnPct: 20 }),
        valued({ portfolioId: "portfolio-d", userId: "user-d", totalValue: 1_100_000, cumulativeReturnPct: 10 }),
      ]),
    );
    dbMock.user.findMany.mockResolvedValue([
      { id: "user-a", avatarUrl: "data:image/jpeg;base64,AAA" },
      { id: "user-d", avatarUrl: "data:image/jpeg;base64,DDD" },
    ]);

    const leaderboard = await getLeaderboard("promo-1", NOW);

    // user-d est 4e (hors podium) mais sa photo doit quand même remonter.
    expect(leaderboard.find((row) => row.userId === "user-d")?.avatarUrl).toBe("data:image/jpeg;base64,DDD");
    expect(leaderboard.find((row) => row.userId === "user-a")?.avatarUrl).toBe("data:image/jpeg;base64,AAA");
    expect(leaderboard.find((row) => row.userId === "user-b")?.avatarUrl).toBeNull();
    expect(dbMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["user-a", "user-b", "user-c", "user-d"] } } }),
    );
  });

  it("en mode figé, demande une valorisation figée (sans appel fournisseur)", async () => {
    const AS_OF = new Date("2026-08-28T11:00:00Z");
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-a", user: { id: "user-a", name: "Alice" } }]);
    getPromotionValuationMock.mockResolvedValue(
      valuation([valued({ portfolioId: "portfolio-a", userId: "user-a", totalValue: 1_200, cumulativeReturnPct: -99.88 })]),
    );

    const leaderboard = await getLeaderboard("promo-1", AS_OF, { frozen: true });

    expect(getPromotionValuationMock).toHaveBeenCalledWith("promo-1", AS_OF, { frozen: true });
    expect(getCachedPromotionValuationMock).not.toHaveBeenCalled();
    expect(leaderboard[0].totalValue).toBe(1_200);
  });
});
