import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = { hallOfFameEntry: { findMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ db: dbMock }));

const { getFrozenLeaderboard } = await import("./frozen-leaderboard");

beforeEach(() => dbMock.hallOfFameEntry.findMany.mockReset());

describe("getFrozenLeaderboard", () => {
  it("interroge HallOfFameEntry filtré par promotion et trié par rang final", async () => {
    dbMock.hallOfFameEntry.findMany.mockResolvedValue([]);

    await getFrozenLeaderboard("p1");

    expect(dbMock.hallOfFameEntry.findMany).toHaveBeenCalledWith({
      where: { promotionId: "p1" },
      orderBy: { finalRank: "asc" },
    });
  });

  it("mappe les lignes et convertit les Decimal en nombres", async () => {
    dbMock.hallOfFameEntry.findMany.mockResolvedValue([
      { userId: "u1", userName: "Alice", finalRank: 1, finalReturnPct: "12.5", finalPnlEur: "120000.00" },
      { userId: "u2", userName: "Bob", finalRank: 2, finalReturnPct: "-2", finalPnlEur: "-20000" },
    ]);

    const rows = await getFrozenLeaderboard("p1");

    expect(rows).toEqual([
      { userId: "u1", userName: "Alice", finalRank: 1, finalReturnPct: 12.5, finalPnlEur: 120000 },
      { userId: "u2", userName: "Bob", finalRank: 2, finalReturnPct: -2, finalPnlEur: -20000 },
    ]);
    expect(typeof rows[0].finalReturnPct).toBe("number");
  });

  it("préserve l'ordre renvoyé par la base (tri délégué à Prisma)", async () => {
    dbMock.hallOfFameEntry.findMany.mockResolvedValue([
      { userId: "u1", userName: "Alice", finalRank: 1, finalReturnPct: 12, finalPnlEur: 120000 },
      { userId: "u2", userName: "Bob", finalRank: 2, finalReturnPct: -2, finalPnlEur: -20000 },
      { userId: null, userName: "Compte supprimé", finalRank: 3, finalReturnPct: -8, finalPnlEur: -80000 },
    ]);

    const rows = await getFrozenLeaderboard("p1");

    expect(rows.map((r) => r.userName)).toEqual(["Alice", "Bob", "Compte supprimé"]);
    expect(rows[2].userId).toBeNull();
  });

  it("renvoie un tableau vide quand la finalisation n'a pas encore écrit de lignes", async () => {
    dbMock.hallOfFameEntry.findMany.mockResolvedValue([]);
    expect(await getFrozenLeaderboard("p1")).toEqual([]);
  });
});
