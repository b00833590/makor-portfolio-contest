import { describe, it, expect } from "vitest";
import { rankEntries, computeRankChange } from "./ranking";

describe("rankEntries", () => {
  it("classe par rendement cumulé décroissant", () => {
    const result = rankEntries([
      { portfolioId: "a", cumulativeReturnPct: 5 },
      { portfolioId: "b", cumulativeReturnPct: 15 },
      { portfolioId: "c", cumulativeReturnPct: -2 },
    ]);

    expect(result.map((entry) => entry.portfolioId)).toEqual(["b", "a", "c"]);
    expect(result.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it("gère une liste vide", () => {
    expect(rankEntries([])).toEqual([]);
  });

  it("conserve les autres champs de chaque entrée", () => {
    const result = rankEntries([{ portfolioId: "a", cumulativeReturnPct: 5, userId: "user-1" }]);

    expect(result[0]).toEqual({ portfolioId: "a", cumulativeReturnPct: 5, userId: "user-1", rank: 1 });
  });
});

describe("computeRankChange", () => {
  it("renvoie une progression positive quand le rang s'améliore", () => {
    // rang 5 avant, rang 2 maintenant -> +3 places gagnées
    expect(computeRankChange(2, 5)).toBe(3);
  });

  it("renvoie une valeur négative quand le rang recule", () => {
    expect(computeRankChange(5, 2)).toBe(-3);
  });

  it("renvoie 0 en l'absence de rang précédent", () => {
    expect(computeRankChange(2, null)).toBe(0);
  });
});
