import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  promotion: { findUniqueOrThrow: vi.fn() },
  portfolio: { findMany: vi.fn() },
  performanceSnapshot: { findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { getLeaderboard } = await import("./get-leaderboard");

const NOW = new Date("2026-09-15T12:00:00Z");

function resetMocks() {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
}

beforeEach(() => {
  resetMocks();
});

describe("getLeaderboard", () => {
  it("classe les participants par rendement cumulé et calcule la progression de rang", async () => {
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
    dbMock.portfolio.findMany.mockResolvedValue([
      { id: "portfolio-a", user: { id: "user-a", name: "Alice", email: "alice@makor.com" } },
      { id: "portfolio-b", user: { id: "user-b", name: "Bob", email: "bob@makor.com" } },
    ]);

    // Alice: en tête aujourd'hui (rang 1) mais était 2e il y a 7 jours -> +1
    // Bob: 2e aujourd'hui mais était 1er il y a 7 jours -> -1
    dbMock.performanceSnapshot.findFirst.mockImplementation(({ where }: { where: { portfolioId: string; timestamp: { lte: Date } } }) => {
      const isRecent = where.timestamp.lte.getTime() === NOW.getTime();
      if (where.portfolioId === "portfolio-a") {
        return Promise.resolve(
          isRecent
            ? { totalValue: 1_100_000, cumulativeReturnPct: 10 }
            : { totalValue: 1_020_000, cumulativeReturnPct: 2 },
        );
      }
      return Promise.resolve(
        isRecent
          ? { totalValue: 1_050_000, cumulativeReturnPct: 5 }
          : { totalValue: 1_030_000, cumulativeReturnPct: 3 },
      );
    });

    const leaderboard = await getLeaderboard("promo-1", NOW);

    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]).toMatchObject({ userId: "user-a", rank: 1, rankChange: 1 });
    expect(leaderboard[1]).toMatchObject({ userId: "user-b", rank: 2, rankChange: -1 });
  });

  it("utilise le capital initial et un rendement de 0% quand aucun snapshot n'existe encore", async () => {
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
    dbMock.portfolio.findMany.mockResolvedValue([
      { id: "portfolio-a", user: { id: "user-a", name: "Alice", email: "alice@makor.com" } },
    ]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);

    const leaderboard = await getLeaderboard("promo-1", NOW);

    expect(leaderboard[0]).toMatchObject({
      totalValue: 1_000_000,
      cumulativeReturnPct: 0,
      rank: 1,
      rankChange: 0,
      weeklyReturnPct: null,
    });
  });
});
