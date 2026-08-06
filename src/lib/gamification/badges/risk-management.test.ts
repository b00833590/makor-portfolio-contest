import { describe, it, expect } from "vitest";
import { riskManagementBadges } from "./risk-management";
import { baseContext, NOW } from "./badge-test-context";

function spec(code: string) {
  const found = riskManagementBadges.find((badge) => badge.code === code);
  if (!found?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return found.evaluate;
}

describe("SANG_FROID", () => {
  it("est attribué si aucune position ne dépasse -5% (au moins 3 positions)", () => {
    const positions = [
      { marketValue: 96_000, costBasis: 100_000 },
      { marketValue: 100_000, costBasis: 100_000 },
      { marketValue: 110_000, costBasis: 100_000 },
    ];
    expect(spec("SANG_FROID")(baseContext({ positions }))).toBe(true);
  });
  it("n'est pas attribué si une position dépasse -5%", () => {
    const positions = [
      { marketValue: 94_000, costBasis: 100_000 },
      { marketValue: 100_000, costBasis: 100_000 },
      { marketValue: 100_000, costBasis: 100_000 },
    ];
    expect(spec("SANG_FROID")(baseContext({ positions }))).toBe(false);
  });
  it("n'est pas attribué avec moins de 3 positions", () => {
    const positions = [
      { marketValue: 100_000, costBasis: 100_000 },
      { marketValue: 100_000, costBasis: 100_000 },
    ];
    expect(spec("SANG_FROID")(baseContext({ positions }))).toBe(false);
  });
});

describe("TOUT_AU_VERT", () => {
  it("est attribué si toutes les positions sont en gain (au moins 3)", () => {
    const positions = [
      { marketValue: 101_000, costBasis: 100_000 },
      { marketValue: 100_000, costBasis: 100_000 },
      { marketValue: 105_000, costBasis: 100_000 },
    ];
    expect(spec("TOUT_AU_VERT")(baseContext({ positions }))).toBe(true);
  });
  it("n'est pas attribué si une position est en perte", () => {
    const positions = [
      { marketValue: 99_000, costBasis: 100_000 },
      { marketValue: 100_000, costBasis: 100_000 },
      { marketValue: 105_000, costBasis: 100_000 },
    ];
    expect(spec("TOUT_AU_VERT")(baseContext({ positions }))).toBe(false);
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe("SEMAINE_SANS_ACCROC", () => {
  it("est attribué si toutes les ventes des 7 derniers jours sont gagnantes", () => {
    const ctx = baseContext({
      closedTradesChronological: [
        { pnlEur: 10, pnlPct: 5, closedAt: new Date(NOW.getTime() - 2 * DAY_MS) },
        { pnlEur: 5, pnlPct: 2, closedAt: new Date(NOW.getTime() - 5 * DAY_MS) },
      ],
    });
    expect(spec("SEMAINE_SANS_ACCROC")(ctx)).toBe(true);
  });
  it("n'est pas attribué si une vente perdante a eu lieu dans les 7 derniers jours", () => {
    const ctx = baseContext({
      closedTradesChronological: [
        { pnlEur: 10, pnlPct: 5, closedAt: new Date(NOW.getTime() - 2 * DAY_MS) },
        { pnlEur: -5, pnlPct: -2, closedAt: new Date(NOW.getTime() - 5 * DAY_MS) },
      ],
    });
    expect(spec("SEMAINE_SANS_ACCROC")(ctx)).toBe(false);
  });
  it("ignore les ventes perdantes antérieures à 7 jours", () => {
    const ctx = baseContext({
      closedTradesChronological: [
        { pnlEur: 10, pnlPct: 5, closedAt: new Date(NOW.getTime() - 2 * DAY_MS) },
        { pnlEur: -5, pnlPct: -2, closedAt: new Date(NOW.getTime() - 10 * DAY_MS) },
      ],
    });
    expect(spec("SEMAINE_SANS_ACCROC")(ctx)).toBe(true);
  });
  it("n'est pas attribué sans aucune vente récente", () => {
    expect(spec("SEMAINE_SANS_ACCROC")(baseContext({ closedTradesChronological: [] }))).toBe(false);
  });
});
