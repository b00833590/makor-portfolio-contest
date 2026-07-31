import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  badge: { upsert: vi.fn() },
  position: { findMany: vi.fn() },
  transaction: { findFirst: vi.fn(), findMany: vi.fn() },
  userBadge: { upsert: vi.fn() },
  // utilisé indirectement par getLeaderboard
  promotion: { findUniqueOrThrow: vi.fn() },
  portfolio: { findMany: vi.fn() },
  performanceSnapshot: { findFirst: vi.fn() },
};

const refreshAssetPricesIfStaleMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/prices/pull-through", () => ({ refreshAssetPricesIfStale: refreshAssetPricesIfStaleMock }));

const { evaluateAndAwardBadges } = await import("./evaluate-badges");
const { badgeDefinitions } = await import("./badge-definitions");

const NOW = new Date("2026-09-15T12:00:00Z");

function resetMocks() {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  refreshAssetPricesIfStaleMock.mockReset();
  refreshAssetPricesIfStaleMock.mockResolvedValue(new Map());
  dbMock.transaction.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  resetMocks();
});

describe("evaluateAndAwardBadges", () => {
  it("attribue le badge Diversificateur à un participant qui respecte le critère", async () => {
    dbMock.badge.upsert.mockImplementation(({ where }: { where: { code: string } }) =>
      Promise.resolve({ id: `badge-${where.code}`, code: where.code }),
    );

    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
    dbMock.portfolio.findMany.mockResolvedValue([
      { id: "portfolio-a", user: { id: "user-a", name: "Alice", email: "alice@makor.com" } },
    ]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null); // pas d'historique -> cumulativeReturnPct 0

    dbMock.position.findMany.mockResolvedValue([
      {
        quantity: 100,
        avgEntryPrice: 1_000,
        asset: { prices: [{ price: 1_000 }] },
      },
      {
        quantity: 100,
        avgEntryPrice: 1_000,
        asset: { prices: [{ price: 1_000 }] },
      },
      {
        quantity: 100,
        avgEntryPrice: 1_000,
        asset: { prices: [{ price: 1_000 }] },
      },
      {
        quantity: 100,
        avgEntryPrice: 1_000,
        asset: { prices: [{ price: 1_000 }] },
      },
      {
        quantity: 100,
        avgEntryPrice: 1_000,
        asset: { prices: [{ price: 1_000 }] },
      },
    ]);
    dbMock.transaction.findFirst.mockResolvedValue(null);

    const results = await evaluateAndAwardBadges("promo-1", NOW);

    expect(dbMock.badge.upsert).toHaveBeenCalledTimes(badgeDefinitions.length);
    expect(results).toEqual([{ userId: "user-a", awarded: ["DIVERSIFICATEUR"] }]);
    expect(dbMock.userBadge.upsert).toHaveBeenCalledWith({
      where: {
        userId_badgeId_promotionId: {
          userId: "user-a",
          badgeId: "badge-DIVERSIFICATEUR",
          promotionId: "promo-1",
        },
      },
      update: {},
      create: { userId: "user-a", badgeId: "badge-DIVERSIFICATEUR", promotionId: "promo-1" },
    });
  });

  it("n'attribue aucun badge quand aucun critère n'est rempli", async () => {
    dbMock.badge.upsert.mockImplementation(({ where }: { where: { code: string } }) =>
      Promise.resolve({ id: `badge-${where.code}`, code: where.code }),
    );
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", initialCapital: 1_000_000 });
    dbMock.portfolio.findMany.mockResolvedValue([
      { id: "portfolio-a", user: { id: "user-a", name: "Alice", email: "alice@makor.com" } },
    ]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);
    dbMock.position.findMany.mockResolvedValue([]);
    dbMock.transaction.findFirst.mockResolvedValue(null);

    const results = await evaluateAndAwardBadges("promo-1", NOW);

    expect(results).toEqual([{ userId: "user-a", awarded: [] }]);
    expect(dbMock.userBadge.upsert).not.toHaveBeenCalled();
  });
});
