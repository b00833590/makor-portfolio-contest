import { describe, it, expect } from "vitest";
import { pickWinner } from "./pick-winner";

describe("pickWinner", () => {
  it("renvoie l'entrée avec le meilleur rendement cumulé", () => {
    const entries = [
      { userId: "a", cumulativeReturnPct: 5 },
      { userId: "b", cumulativeReturnPct: 22 },
      { userId: "c", cumulativeReturnPct: -3 },
    ];

    expect(pickWinner(entries)?.userId).toBe("b");
  });

  it("renvoie null pour une liste vide", () => {
    expect(pickWinner([])).toBeNull();
  });

  it("gère un seul élément", () => {
    const entries = [{ userId: "a", cumulativeReturnPct: 1 }];
    expect(pickWinner(entries)?.userId).toBe("a");
  });
});
