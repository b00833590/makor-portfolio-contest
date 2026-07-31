import { describe, it, expect } from "vitest";
import { computeSnapshot } from "./performance-snapshot";

describe("computeSnapshot", () => {
  it("calcule la valeur totale comme cash disponible + valeur de marché des positions", () => {
    const result = computeSnapshot({
      availableCash: 100_000,
      positions: [
        { quantity: 100, currentPrice: 200 }, // 20 000
        { quantity: 50, currentPrice: 1_000 }, // 50 000
      ],
      initialCapital: 1_000_000,
      previousSnapshot: null,
    });

    expect(result.totalValue).toBe(170_000);
  });

  it("calcule le rendement cumulé par rapport au capital initial", () => {
    const result = computeSnapshot({
      availableCash: 0,
      positions: [{ quantity: 1, currentPrice: 1_100_000 }],
      initialCapital: 1_000_000,
      previousSnapshot: null,
    });

    expect(result.cumulativeReturnPct).toBeCloseTo(10, 5);
  });

  it("calcule un rendement cumulé négatif en cas de perte", () => {
    const result = computeSnapshot({
      availableCash: 0,
      positions: [{ quantity: 1, currentPrice: 900_000 }],
      initialCapital: 1_000_000,
      previousSnapshot: null,
    });

    expect(result.cumulativeReturnPct).toBeCloseTo(-10, 5);
  });

  it("renvoie un rendement journalier de 0 s'il n'y a pas de snapshot précédent", () => {
    const result = computeSnapshot({
      availableCash: 1_000_000,
      positions: [],
      initialCapital: 1_000_000,
      previousSnapshot: null,
    });

    expect(result.dailyReturnPct).toBe(0);
  });

  it("calcule le rendement journalier par rapport au snapshot précédent", () => {
    const result = computeSnapshot({
      availableCash: 0,
      positions: [{ quantity: 1, currentPrice: 1_050_000 }],
      initialCapital: 1_000_000,
      previousSnapshot: { totalValue: 1_000_000 },
    });

    expect(result.dailyReturnPct).toBeCloseTo(5, 5);
  });

  it("gère un capital initial ou une valeur précédente à zéro sans diviser par zéro", () => {
    const result = computeSnapshot({
      availableCash: 0,
      positions: [],
      initialCapital: 0,
      previousSnapshot: { totalValue: 0 },
    });

    expect(result.totalValue).toBe(0);
    expect(result.cumulativeReturnPct).toBe(0);
    expect(result.dailyReturnPct).toBe(0);
  });
});
