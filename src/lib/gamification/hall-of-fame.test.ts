import { describe, it, expect, vi, beforeEach } from "vitest";

let storedEntries: Record<string, unknown>[] = [];

interface AvatarOrCond {
  finalRank?: { lte: number } | number;
  userId?: string;
  promotionId?: string;
}
interface FindManyOptions {
  orderBy?:
    | { finalReturnPct?: "asc" | "desc" }
    | Array<{ finalReturnPct?: "asc" | "desc"; closedAt?: "asc" | "desc" }>;
  where?: { avatarUrl?: { not: null }; OR?: AvatarOrCond[] };
}

// Le mock reproduit le contrat Prisma dont dépend getHallOfFame : `orderBy`
// (tri délégué à la base) et le `where` de la 2e requête (photos du podium,
// du visiteur, et de la pire performance historique). Si l'un ou l'autre est
// retiré du code, les tests ci-dessous doivent casser.
const dbMock = {
  hallOfFameEntry: {
    findMany: vi.fn(async (options: FindManyOptions) => {
      let data = [...storedEntries];
      if (options?.where) {
        const w = options.where;
        data = data.filter((row) => {
          if (w.avatarUrl?.not === null && row.avatarUrl == null) return false;
          if (w.OR) {
            return w.OR.some((cond) => {
              if (cond.promotionId != null) {
                return row.promotionId === cond.promotionId && row.finalRank === cond.finalRank;
              }
              if (cond.userId != null) return row.userId === cond.userId;
              if (cond.finalRank != null && typeof cond.finalRank === "object") {
                return (row.finalRank as number) <= cond.finalRank.lte;
              }
              return false;
            });
          }
          return true;
        });
      }
      const orderByList = Array.isArray(options?.orderBy)
        ? options.orderBy
        : options?.orderBy
          ? [options.orderBy]
          : [];
      if (orderByList.some((o) => o.finalReturnPct === "desc")) {
        const closedAtDesc = orderByList.some((o) => "closedAt" in o && o.closedAt === "desc");
        data.sort((a, b) => {
          const diff = (b.finalReturnPct as number) - (a.finalReturnPct as number);
          if (diff !== 0) return diff;
          if (closedAtDesc) return (b.closedAt as Date).getTime() - (a.closedAt as Date).getTime();
          return 0;
        });
      }
      return data;
    }),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { getHallOfFame } = await import("./hall-of-fame");

function entry(over: Partial<Record<string, unknown>>) {
  const merged = {
    promotionId: "p1", promotionName: "Saison 1",
    userName: "Alice",
    finalReturnPct: 10, finalPnlEur: 100_000, finalRank: 1,
    avatarUrl: null as string | null,
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

  it("ne renvoie la photo que pour le podium (rang ≤ 3) et pour le visiteur", async () => {
    storedEntries = [
      entry({ userId: "u1", userName: "A", finalRank: 1, avatarUrl: "img-a", promotionId: "p1", promotionName: "S1", finalReturnPct: 30 }),
      entry({ userId: "u4", userName: "D", finalRank: 4, avatarUrl: "img-d", promotionId: "p1", promotionName: "S1", finalReturnPct: 5 }),
      entry({ userId: "viewer", userName: "V", finalRank: 7, avatarUrl: "img-v", promotionId: "p1", promotionName: "S1", finalReturnPct: -8 }),
    ];
    const data = await getHallOfFame("viewer");
    const byName = Object.fromEntries(data.entries.map((e) => [e.userName, e.avatarUrl]));
    expect(byName).toEqual({ A: "img-a", D: null, V: "img-v" });
  });

  it("renvoie aussi la photo de la pire performance historique, même hors podium et hors visiteur", async () => {
    storedEntries = [
      entry({ userId: "u1", userName: "A", finalRank: 1, avatarUrl: "img-a", promotionId: "p1", promotionName: "S1", finalReturnPct: 30 }),
      entry({ userId: "u2", userName: "B", finalRank: 2, avatarUrl: "img-b", promotionId: "p1", promotionName: "S1", finalReturnPct: 10 }),
      entry({ userId: "u3", userName: "C", finalRank: 3, avatarUrl: "img-c", promotionId: "p1", promotionName: "S1", finalReturnPct: 5 }),
      entry({ userId: "u4", userName: "D", finalRank: 4, avatarUrl: "img-d", promotionId: "p1", promotionName: "S1", finalReturnPct: 2 }),
      entry({ userId: "u5", userName: "E", finalRank: 5, avatarUrl: "img-e", promotionId: "p1", promotionName: "S1", finalReturnPct: -12 }),
    ];
    const data = await getHallOfFame();
    const worst = data.entries.at(-1);
    expect(worst?.userName).toBe("E");
    expect(worst?.avatarUrl).toBe("img-e");
    // Rang 4 : ni podium, ni pire, ni visiteur — sa photo ne doit toujours pas remonter.
    const rankFour = data.entries.find((e) => e.userName === "D");
    expect(rankFour?.avatarUrl).toBeNull();
  });

  it("la pire performance historique = la meilleure quand il n'existe qu'une seule entrée au total", async () => {
    storedEntries = [
      entry({ userId: "solo", userName: "Solo", finalRank: 1, avatarUrl: "img-solo", promotionId: "p1", promotionName: "S1", finalReturnPct: 4 }),
    ];
    const data = await getHallOfFame();
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0]).toBe(data.entries.at(-1));
    expect(data.entries[0].avatarUrl).toBe("img-solo");

    // Vérifier que le worst-entry OR condition est bien envoyé au mock, indépendant
    // du fait que la condition podium (finalRank <= 3) couvrirait aussi cette entrée.
    const secondCall = dbMock.hallOfFameEntry.findMany.mock.calls[1];
    const orConditions = secondCall[0]?.where?.OR ?? [];
    const hasWorstEntryCondition = orConditions.some(
      (cond) => cond.promotionId === "p1" && cond.finalRank === 1
    );
    expect(hasWorstEntryCondition).toBe(true);
  });

  it("départage deux performances à égalité par la clôture la plus récente", async () => {
    storedEntries = [
      entry({ userName: "Ancien", finalReturnPct: 7, promotionId: "p1", promotionName: "S1", closedAt: new Date("2026-01-31") }),
      entry({ userName: "Recent", finalReturnPct: 7, promotionId: "p2", promotionName: "S2", finalRank: 1, closedAt: new Date("2026-06-30") }),
    ];
    const data = await getHallOfFame();
    expect(data.entries.map((e) => e.userName)).toEqual(["Recent", "Ancien"]);
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
