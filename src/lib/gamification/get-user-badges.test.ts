import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/db", () => ({ db: { userBadge: { findMany } } }));

const { getUserBadges } = await import("./get-user-badges");

beforeEach(() => findMany.mockReset());

function row(code: string, awardedAt: string, promotionId: string) {
  return {
    awardedAt: new Date(awardedAt),
    promotionId,
    badge: {
      code,
      name: code,
      description: "d",
      condition: "c",
      category: "TRADING",
      rarity: "COMMON",
      icon: "i",
    },
  };
}

describe("getUserBadges", () => {
  it("interroge toutes les promotions du participant sans argument promotionId", async () => {
    findMany.mockResolvedValue([]);

    await getUserBadges("user-a");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a" } }),
    );
  });

  it("filtre sur la promotion quand promotionId est fourni", async () => {
    findMany.mockResolvedValue([]);

    await getUserBadges("user-a", "promo-sept");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-a", promotionId: "promo-sept" } }),
    );
  });

  it("fusionne les badges de plusieurs promotions et dédoublonne par code", async () => {
    findMany.mockResolvedValue([
      row("PREMIER_PAS", "2026-08-02T00:00:00Z", "promo-aout"),
      row("CHAMPION_DU_CONCOURS", "2026-08-28T00:00:00Z", "promo-aout"),
      row("PREMIER_PAS", "2026-09-03T00:00:00Z", "promo-sept"), // regagné → ignoré
    ]);

    const result = await getUserBadges("user-a");

    expect(result.map((b) => b.code).sort()).toEqual(["CHAMPION_DU_CONCOURS", "PREMIER_PAS"]);
  });

  it("garde la date de première obtention pour un badge regagné", async () => {
    // Le service demande orderBy awardedAt asc → la plus ancienne arrive en premier.
    findMany.mockResolvedValue([
      row("PREMIER_PAS", "2026-08-02T00:00:00Z", "promo-aout"),
      row("PREMIER_PAS", "2026-09-03T00:00:00Z", "promo-sept"),
    ]);

    const result = await getUserBadges("user-a");

    expect(result).toHaveLength(1);
    expect(result[0].awardedAt).toEqual(new Date("2026-08-02T00:00:00Z"));
  });

  it("demande un tri par date d'obtention croissante", async () => {
    findMany.mockResolvedValue([]);
    await getUserBadges("user-a");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { awardedAt: "asc" } }),
    );
  });
});
