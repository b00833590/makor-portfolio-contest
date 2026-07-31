import { describe, it, expect } from "vitest";
import { evaluateBadgeCriteria } from "./badge-criteria";
import type { BadgeEvaluationContext } from "./badge-criteria";

const NOW = new Date("2026-09-15T12:00:00Z");

function baseContext(overrides: Partial<BadgeEvaluationContext> = {}): BadgeEvaluationContext {
  return {
    now: NOW,
    investedValue: 1_000_000,
    positions: [],
    lastTransactionDate: null,
    cumulativeReturnPct: 0,
    currentRank: null,
    previousRank: null,
    ...overrides,
  };
}

describe("DIVERSIFICATEUR", () => {
  it("est attribué quand aucune position ne dépasse 20% de la valeur totale", () => {
    const ctx = baseContext({
      investedValue: 500_000,
      positions: [
        { marketValue: 100_000, costBasis: 100_000 },
        { marketValue: 100_000, costBasis: 100_000 },
        { marketValue: 100_000, costBasis: 100_000 },
        { marketValue: 100_000, costBasis: 100_000 },
        { marketValue: 100_000, costBasis: 100_000 },
      ],
    });

    expect(evaluateBadgeCriteria(ctx)).toContain("DIVERSIFICATEUR");
  });

  it("n'est pas attribué si une position dépasse 20%", () => {
    const ctx = baseContext({
      investedValue: 500_000,
      positions: [
        { marketValue: 150_000, costBasis: 150_000 },
        { marketValue: 350_000, costBasis: 350_000 },
      ],
    });

    expect(evaluateBadgeCriteria(ctx)).not.toContain("DIVERSIFICATEUR");
  });

  it("n'est pas attribué sans aucune position", () => {
    expect(evaluateBadgeCriteria(baseContext({ positions: [] }))).not.toContain("DIVERSIFICATEUR");
  });
});

describe("SNIPER", () => {
  it("est attribué si une position affiche un gain latent d'au moins 30%", () => {
    const ctx = baseContext({
      positions: [{ marketValue: 130_000, costBasis: 100_000 }],
    });

    expect(evaluateBadgeCriteria(ctx)).toContain("SNIPER");
  });

  it("n'est pas attribué si aucune position n'atteint 30% de gain", () => {
    const ctx = baseContext({
      positions: [{ marketValue: 110_000, costBasis: 100_000 }],
    });

    expect(evaluateBadgeCriteria(ctx)).not.toContain("SNIPER");
  });
});

describe("MAIN_DE_FER", () => {
  it("est attribué sans changement depuis 14 jours et avec un rendement positif", () => {
    const ctx = baseContext({
      lastTransactionDate: new Date("2026-09-01T00:00:00Z"), // 14 jours avant NOW
      cumulativeReturnPct: 5,
    });

    expect(evaluateBadgeCriteria(ctx)).toContain("MAIN_DE_FER");
  });

  it("n'est pas attribué si un changement a eu lieu il y a moins de 14 jours", () => {
    const ctx = baseContext({
      lastTransactionDate: new Date("2026-09-10T00:00:00Z"),
      cumulativeReturnPct: 5,
    });

    expect(evaluateBadgeCriteria(ctx)).not.toContain("MAIN_DE_FER");
  });

  it("n'est pas attribué si le rendement est négatif", () => {
    const ctx = baseContext({
      lastTransactionDate: new Date("2026-09-01T00:00:00Z"),
      cumulativeReturnPct: -2,
    });

    expect(evaluateBadgeCriteria(ctx)).not.toContain("MAIN_DE_FER");
  });

  it("n'est pas attribué en l'absence de toute transaction", () => {
    const ctx = baseContext({ lastTransactionDate: null, cumulativeReturnPct: 5 });

    expect(evaluateBadgeCriteria(ctx)).not.toContain("MAIN_DE_FER");
  });
});

describe("COMEBACK", () => {
  it("est attribué en cas de progression d'au moins 3 places en une semaine", () => {
    const ctx = baseContext({ currentRank: 2, previousRank: 8 });

    expect(evaluateBadgeCriteria(ctx)).toContain("COMEBACK");
  });

  it("n'est pas attribué pour une progression de moins de 3 places", () => {
    const ctx = baseContext({ currentRank: 5, previousRank: 6 });

    expect(evaluateBadgeCriteria(ctx)).not.toContain("COMEBACK");
  });

  it("n'est pas attribué sans historique de rang", () => {
    const ctx = baseContext({ currentRank: 1, previousRank: null });

    expect(evaluateBadgeCriteria(ctx)).not.toContain("COMEBACK");
  });
});
