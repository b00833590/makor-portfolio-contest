import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserBadgesMock = vi.fn();
vi.mock("./get-user-badges", () => ({ getUserBadges: getUserBadgesMock }));

const { getBadgeBoard } = await import("./get-badge-board");
const { BADGE_CATALOG } = await import("./badges/catalog");

beforeEach(() => {
  getUserBadgesMock.mockReset();
});

describe("getBadgeBoard", () => {
  it("expose tout le catalogue, avec earned:false et awardedAt:null par défaut", async () => {
    getUserBadgesMock.mockResolvedValue([]);

    const board = await getBadgeBoard("user-a", "promo-1");

    expect(board.entries).toHaveLength(BADGE_CATALOG.length);
    expect(board.entries.every((entry) => !entry.earned && entry.awardedAt === null)).toBe(true);
    expect(board.earnedCount).toBe(0);
    expect(board.completionPct).toBe(0);
    expect(board.xp).toBe(0);
    expect(board.level.level).toBe(1);
    expect(board.mostRecentBadge).toBe(null);
  });

  it("marque comme obtenus les badges présents dans getUserBadges", async () => {
    const awardedAt = new Date("2026-09-10T00:00:00Z");
    getUserBadgesMock.mockResolvedValue([
      {
        code: "PREMIER_PAS",
        name: "Premier pas",
        description: "d",
        condition: "c",
        category: "TRADING",
        rarity: "COMMON",
        icon: "🐣",
        awardedAt,
      },
    ]);

    const board = await getBadgeBoard("user-a", "promo-1");

    const entry = board.entries.find((e) => e.code === "PREMIER_PAS")!;
    expect(entry.earned).toBe(true);
    expect(entry.awardedAt).toEqual(awardedAt);
    expect(board.earnedCount).toBe(1);
    expect(board.completionPct).toBeCloseTo((1 / BADGE_CATALOG.length) * 100, 5);
    expect(board.xp).toBe(10);
  });

  it("compte les badges rares (Épique + Légendaire) obtenus", async () => {
    getUserBadgesMock.mockResolvedValue([
      { code: "PREMIER_PAS", name: "n", description: "d", condition: "c", category: "TRADING", rarity: "COMMON", icon: "i", awardedAt: new Date() },
      { code: "MAIN_CHAUDE", name: "n", description: "d", condition: "c", category: "TRADING", rarity: "EPIC", icon: "i", awardedAt: new Date() },
      { code: "GROS_COUP", name: "n", description: "d", condition: "c", category: "TRADING", rarity: "EPIC", icon: "i", awardedAt: new Date() },
    ]);

    const board = await getBadgeBoard("user-a", "promo-1");

    // rareOwnedCount dérive de la rareté du CATALOGUE, pas du mock : PREMIER_PAS=COMMON,
    // MAIN_CHAUDE=EPIC, GROS_COUP=EPIC → 2 rares.
    expect(board.rareOwnedCount).toBe(2);
  });

  it("identifie le badge le plus récemment obtenu", async () => {
    getUserBadgesMock.mockResolvedValue([
      { code: "PREMIER_PAS", name: "n", description: "d", condition: "c", category: "TRADING", rarity: "COMMON", icon: "i", awardedAt: new Date("2026-09-01T00:00:00Z") },
      { code: "PREMIERE_VICTOIRE", name: "n", description: "d", condition: "c", category: "TRADING", rarity: "COMMON", icon: "i", awardedAt: new Date("2026-09-10T00:00:00Z") },
    ]);

    const board = await getBadgeBoard("user-a", "promo-1");

    expect(board.mostRecentBadge?.code).toBe("PREMIERE_VICTOIRE");
  });
});

describe("getBadgeBoard — regroupements UI", () => {
  it("byRarity couvre les 4 raretés et somme au total du catalogue", async () => {
    getUserBadgesMock.mockResolvedValue([]);
    const board = await getBadgeBoard("user-a", "promo-1");
    expect(board.byRarity.map((r) => r.rarity)).toEqual(["COMMON", "RARE", "EPIC", "LEGENDARY"]);
    expect(board.byRarity.reduce((s, r) => s + r.total, 0)).toBe(board.totalCount);
    expect(board.byRarity.every((r) => r.earned === 0)).toBe(true);
  });

  it("byCategory est ordonné et chaque section somme correctement", async () => {
    getUserBadgesMock.mockResolvedValue([]);
    const board = await getBadgeBoard("user-a", "promo-1");
    expect(board.byCategory.map((c) => c.category)).toEqual([
      "PERFORMANCE", "RANKING", "TRADING", "RISK_MANAGEMENT", "DIVERSIFICATION", "DISTINCTION", "SPECIAL_EVENT",
    ]);
    expect(board.byCategory.reduce((s, c) => s + c.total, 0)).toBe(board.totalCount);
    for (const c of board.byCategory) {
      expect(c.entries).toHaveLength(c.total);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });
});
