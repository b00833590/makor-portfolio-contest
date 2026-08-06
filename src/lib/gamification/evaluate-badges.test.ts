import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  badge: { upsert: vi.fn(), findMany: vi.fn() },
  position: { findMany: vi.fn() },
  transaction: { findMany: vi.fn() },
  price: { findMany: vi.fn() },
  performanceSnapshot: { findMany: vi.fn() },
  changeSession: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  userBadge: { findMany: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  promotion: { findUniqueOrThrow: vi.fn() },
};

const getLeaderboardMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("./get-leaderboard", () => ({ getLeaderboard: getLeaderboardMock }));

const { evaluateAndAwardBadges, evaluateUserBadges, evaluateUserBadgesForUser, markBadgesSeen, ensureBadgesSeeded } =
  await import("./evaluate-badges");
const { BADGE_CATALOG } = await import("./badges/catalog");

const NOW = new Date("2026-09-15T12:00:00Z");

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

const EMPTY_ROW = {
  userId: "user-a",
  name: "Alice",
  avatarUrl: null,
  portfolioId: "portfolio-a",
  totalValue: 1_000_000,
  cumulativeReturnPct: 0,
  rank: 2,
  previousRank: null,
  rankChange: 0,
  weeklyReturnPct: null,
  bestPosition: null,
  worstPosition: null,
};

function resetMocks() {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  getLeaderboardMock.mockReset();

  dbMock.badge.upsert.mockImplementation(({ where }: { where: { code: string } }) =>
    Promise.resolve({ id: `badge-${where.code}`, code: where.code }),
  );
  dbMock.badge.findMany.mockImplementation(({ where }: { where: { code: { in: string[] } } }) =>
    Promise.resolve(
      where.code.in.map((code) => {
        const spec = BADGE_CATALOG.find((b) => b.code === code)!;
        return { id: `badge-${code}`, code, name: spec.name, rarity: spec.rarity };
      }),
    ),
  );
  dbMock.position.findMany.mockResolvedValue([]);
  dbMock.transaction.findMany.mockResolvedValue([]);
  dbMock.price.findMany.mockResolvedValue([]);
  dbMock.performanceSnapshot.findMany.mockResolvedValue([]);
  dbMock.changeSession.findMany.mockResolvedValue([]);
  dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1", currentStreakDays: 0, longestStreakDays: 0 });
  dbMock.userBadge.findMany.mockResolvedValue([]);
  dbMock.userBadge.count.mockResolvedValue(0);
  dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", rules: PROMOTION_RULES });
  getLeaderboardMock.mockResolvedValue([EMPTY_ROW]);
}

beforeEach(() => {
  resetMocks();
});

describe("ensureBadgesSeeded", () => {
  it("upsert un badge par entrée du catalogue", async () => {
    await ensureBadgesSeeded();
    expect(dbMock.badge.upsert).toHaveBeenCalledTimes(BADGE_CATALOG.length);
  });
});

describe("evaluateAndAwardBadges", () => {
  it("attribue PREMIER_PAS à un participant qui a réalisé une transaction", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      { assetId: "asset-a", type: "BUY", price: 100, quantity: 1, changeSessionId: null, createdAt: NOW },
    ]);

    const results = await evaluateAndAwardBadges("promo-1", NOW);

    expect(results).toEqual([{ userId: "user-a", awarded: ["PREMIER_PAS"] }]);
    expect(dbMock.userBadge.upsert).toHaveBeenCalledWith({
      where: { userId_badgeId_promotionId: { userId: "user-a", badgeId: "badge-PREMIER_PAS", promotionId: "promo-1" } },
      update: {},
      create: { userId: "user-a", badgeId: "badge-PREMIER_PAS", promotionId: "promo-1" },
    });
  });

  it("n'attribue aucun badge quand aucun critère n'est rempli", async () => {
    const results = await evaluateAndAwardBadges("promo-1", NOW);

    expect(results).toEqual([{ userId: "user-a", awarded: [] }]);
    expect(dbMock.userBadge.upsert).not.toHaveBeenCalled();
  });

  it("n'attribue pas deux fois un badge déjà obtenu", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      { assetId: "asset-a", type: "BUY", price: 100, quantity: 1, changeSessionId: null, createdAt: NOW },
    ]);
    dbMock.userBadge.findMany.mockResolvedValue([{ badge: { code: "PREMIER_PAS" } }]);

    const results = await evaluateAndAwardBadges("promo-1", NOW);

    expect(results).toEqual([{ userId: "user-a", awarded: [] }]);
    expect(dbMock.userBadge.upsert).not.toHaveBeenCalled();
  });

  it("n'attribue PIONNIER qu'à un seul participant par promotion", async () => {
    dbMock.position.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        id: `pos-${i}`,
        assetId: `asset-${i}`,
        quantity: 1,
        avgEntryPrice: 100,
        openedAt: NOW,
        closedAt: null,
        asset: { sector: "Tech", currency: "EUR", prices: [{ price: 100 }] },
      })),
    );
    dbMock.promotion.findUniqueOrThrow.mockResolvedValue({ id: "promo-1", rules: PROMOTION_RULES });
    dbMock.userBadge.count.mockResolvedValue(1); // un autre participant a déjà obtenu PIONNIER

    const results = await evaluateAndAwardBadges("promo-1", NOW);

    expect(results[0].awarded).not.toContain("PIONNIER");
  });
});

describe("evaluateUserBadges", () => {
  it("retourne un tableau vide si l'utilisateur n'est pas dans le classement de la promotion", async () => {
    getLeaderboardMock.mockResolvedValue([{ ...EMPTY_ROW, userId: "autre-utilisateur" }]);

    const results = await evaluateUserBadges("user-a", "promo-1", NOW);

    expect(results).toEqual([]);
  });
});

describe("evaluateUserBadgesForUser", () => {
  it("résout la promotion depuis l'utilisateur et marque les badges obtenus comme vus", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      { assetId: "asset-a", type: "BUY", price: 100, quantity: 1, changeSessionId: null, createdAt: NOW },
    ]);

    const results = await evaluateUserBadgesForUser("user-a", NOW);

    expect(results).toEqual([{ code: "PREMIER_PAS", name: "Premier pas", rarity: "COMMON" }]);
    expect(dbMock.userBadge.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-a", promotionId: "promo-1", seenAt: null, badge: { code: { in: ["PREMIER_PAS"] } } },
      data: { seenAt: expect.any(Date) },
    });
  });

  it("ne fait rien si l'utilisateur n'a pas de promotion", async () => {
    dbMock.user.findUnique.mockResolvedValue({ promotionId: null });

    const results = await evaluateUserBadgesForUser("user-a", NOW);

    expect(results).toEqual([]);
    expect(getLeaderboardMock).not.toHaveBeenCalled();
  });
});

describe("markBadgesSeen", () => {
  it("ne fait aucun appel si la liste de codes est vide", async () => {
    await markBadgesSeen("user-a", "promo-1", []);
    expect(dbMock.userBadge.updateMany).not.toHaveBeenCalled();
  });
});
