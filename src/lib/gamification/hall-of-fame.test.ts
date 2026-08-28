import { describe, it, expect, vi, beforeEach } from "vitest";

let storedEntries: unknown[] = [];

interface FindManyOptions {
  orderBy?: {
    finalReturnPct?: "asc" | "desc";
  };
}

const dbMock = {
  hallOfFameEntry: {
    findMany: vi.fn(async (options: FindManyOptions) => {
      // Note: mirrors Prisma's { orderBy: { finalReturnPct: "desc" } } contract;
      // if this sort is removed, tests below must fail to catch the regression.
      const data = [...storedEntries];
      if (options?.orderBy?.finalReturnPct === "desc") {
        return data.sort((a, b) => {
          const aVal = (a as Record<string, number>).finalReturnPct;
          const bVal = (b as Record<string, number>).finalReturnPct;
          return bVal - aVal;
        });
      }
      return data;
    }),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

const { getHallOfFame } = await import("./hall-of-fame");

function entry(over: Partial<Record<string, unknown>>) {
  const merged = {
    promotionId: "p1", promotionName: "Saison 1",
    userName: "Alice",
    finalReturnPct: 10, finalPnlEur: 100_000, finalRank: 1,
    closedAt: new Date("2026-01-31T00:00:00Z"),
    ...over,
  };
  // userId par défaut dérivé du nom : les participations sont agrégées par
  // identité de compte, pas par nom affiché (un `over.userId` explicite gagne).
  return { userId: `u-${merged.userName}`, ...merged };
}

beforeEach(() => {
  storedEntries = [];
  dbMock.hallOfFameEntry.findMany.mockClear();
});

describe("getHallOfFame", () => {
  it("trie les entrées par performance décroissante (meilleure perf de tous les temps en tête)", async () => {
    storedEntries = [
      entry({ userName: "Alice", finalReturnPct: 8, promotionName: "Saison 1", promotionId: "p1" }),
      entry({ userName: "Bob", finalReturnPct: 22, promotionName: "Saison 2", promotionId: "p2", finalRank: 1 }),
      entry({ userName: "Alice", finalReturnPct: -3, promotionName: "Saison 2", promotionId: "p2", finalRank: 2 }),
    ];
    const data = await getHallOfFame();
    expect(data.entries.map((e) => [e.userName, e.finalReturnPct])).toEqual([
      ["Bob", 22], ["Alice", 8], ["Alice", -3],
    ]);
  });

  it("garde une entrée distincte par participation — une même personne apparaît plusieurs fois", async () => {
    storedEntries = [
      entry({ userName: "Alice", finalReturnPct: 12.4, promotionName: "Concours Septembre 2026", promotionId: "sep" }),
      entry({ userName: "Alice", finalReturnPct: -2.1, promotionName: "Concours Octobre 2026", promotionId: "oct" }),
    ];
    const data = await getHallOfFame();
    expect(data.entries).toHaveLength(2);
    expect(data.participations).toEqual([{ userName: "Alice", count: 2, bestReturnPct: 12.4 }]);
  });

  it("ne fusionne pas deux comptes distincts qui partagent le même nom (nom réattribué après suppression)", async () => {
    storedEntries = [
      entry({ userId: "acct-old", userName: "Jean", finalReturnPct: 5, promotionId: "p1", promotionName: "S1" }),
      entry({ userId: "acct-new", userName: "Jean", finalReturnPct: 9, promotionId: "p2", promotionName: "S2", finalRank: 2 }),
    ];
    const data = await getHallOfFame();
    expect(data.participations).toEqual([
      { userName: "Jean", count: 1, bestReturnPct: 9 },
      { userName: "Jean", count: 1, bestReturnPct: 5 },
    ]);
  });

  it("regroupe les podiums par saison, saison la plus récente en premier", async () => {
    storedEntries = [
      entry({ promotionId: "p1", promotionName: "S1", finalRank: 1, userName: "A", closedAt: new Date("2026-01-31") }),
      entry({ promotionId: "p1", promotionName: "S1", finalRank: 4, userName: "D", closedAt: new Date("2026-01-31") }),
      entry({ promotionId: "p2", promotionName: "S2", finalRank: 1, userName: "E", closedAt: new Date("2026-03-31") }),
    ];
    const data = await getHallOfFame();
    expect(data.seasons.map((s) => s.promotionName)).toEqual(["S2", "S1"]);
    expect(data.seasons[1].podium.map((e) => e.userName)).toEqual(["A"]); // rank 4 exclu
  });

  it("renvoie des listes vides quand rien n'est terminé", async () => {
    storedEntries = [];
    const data = await getHallOfFame();
    expect(data).toEqual({ entries: [], seasons: [], participations: [] });
  });

  it("trie le podium par finalRank ascending (même si inséré désordre)", async () => {
    storedEntries = [
      entry({ promotionId: "p1", promotionName: "S1", finalRank: 3, userName: "C", closedAt: new Date("2026-01-31") }),
      entry({ promotionId: "p1", promotionName: "S1", finalRank: 1, userName: "A", closedAt: new Date("2026-01-31") }),
      entry({ promotionId: "p1", promotionName: "S1", finalRank: 2, userName: "B", closedAt: new Date("2026-01-31") }),
      entry({ promotionId: "p1", promotionName: "S1", finalRank: 4, userName: "D", closedAt: new Date("2026-01-31") }),
    ];
    const data = await getHallOfFame();
    expect(data.seasons).toHaveLength(1);
    expect(data.seasons[0].podium.map((e) => e.finalRank)).toEqual([1, 2, 3]);
    expect(data.seasons[0].podium.map((e) => e.userName)).toEqual(["A", "B", "C"]);
  });

  it("trie les participations par bestReturnPct décroissant", async () => {
    storedEntries = [
      entry({ userName: "Alice", finalReturnPct: 5, promotionId: "p1", promotionName: "S1" }),
      entry({ userName: "Bob", finalReturnPct: 15, promotionId: "p1", promotionName: "S1", finalRank: 1 }),
      entry({ userName: "Alice", finalReturnPct: 8, promotionId: "p2", promotionName: "S2", finalRank: 2 }),
    ];
    const data = await getHallOfFame();
    expect(data.participations).toHaveLength(2);
    expect(data.participations.map((p) => p.userName)).toEqual(["Bob", "Alice"]);
    expect(data.participations).toEqual([
      { userName: "Bob", count: 1, bestReturnPct: 15 },
      { userName: "Alice", count: 2, bestReturnPct: 8 },
    ]);
  });
});
