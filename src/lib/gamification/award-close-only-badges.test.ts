import { describe, it, expect, vi } from "vitest";
import type { CloseOnlySummary } from "./award-close-only-badges";

// Le module importe `db` au chargement (via evaluate-badges.ts) — mocké ici même si ces tests
// n'exercent que la fonction pure computeCloseOnlyWinners, pour éviter d'instancier un vrai
// PrismaClient (qui exige DATABASE_URL) à l'import.
vi.mock("@/lib/db", () => ({ db: {} }));

const { computeCloseOnlyWinners } = await import("./award-close-only-badges");

function summary(overrides: Partial<CloseOnlySummary> = {}): CloseOnlySummary {
  return {
    userId: "user-a",
    finalRank: 2,
    usedWindowEveryWeek: false,
    neverExceededMaxLossPct: false,
    wasEverLastAndFinishedTopThree: false,
    heldPositionEntireContest: false,
    bestTradePnlPct: null,
    winRatePct: null,
    bestPostBuyGainPct: null,
    ...overrides,
  };
}

describe("computeCloseOnlyWinners", () => {
  it("attribue CHAMPION_DU_CONCOURS au(x) participant(s) classé(s) 1er", () => {
    const winners = computeCloseOnlyWinners([summary({ userId: "user-a", finalRank: 1 }), summary({ userId: "user-b", finalRank: 2 })]);
    expect(winners).toContainEqual({ userId: "user-a", code: "CHAMPION_DU_CONCOURS" });
    expect(winners).not.toContainEqual({ userId: "user-b", code: "CHAMPION_DU_CONCOURS" });
  });

  it("attribue CHAMPION_DU_CONCOURS à tous les ex-aequo à la 1ère place", () => {
    const winners = computeCloseOnlyWinners([summary({ userId: "user-a", finalRank: 1 }), summary({ userId: "user-b", finalRank: 1 })]);
    expect(winners.filter((w) => w.code === "CHAMPION_DU_CONCOURS")).toHaveLength(2);
  });

  it("attribue les badges booléens individuellement, sans notion de meilleur", () => {
    const winners = computeCloseOnlyWinners([
      summary({ userId: "user-a", usedWindowEveryWeek: true, heldPositionEntireContest: true }),
      summary({ userId: "user-b", neverExceededMaxLossPct: true }),
    ]);
    expect(winners).toContainEqual({ userId: "user-a", code: "STRATEGE_ASSIDU" });
    expect(winners).toContainEqual({ userId: "user-a", code: "FIDELE_AU_POSTE" });
    expect(winners).toContainEqual({ userId: "user-b", code: "SANS_FAUTE" });
  });

  it("attribue MEILLEUR_STOCK_PICKER au meilleur pnl % de trade, en excluant les null", () => {
    const winners = computeCloseOnlyWinners([
      summary({ userId: "user-a", bestTradePnlPct: 40 }),
      summary({ userId: "user-b", bestTradePnlPct: 15 }),
      summary({ userId: "user-c", bestTradePnlPct: null }),
    ]);
    expect(winners).toContainEqual({ userId: "user-a", code: "MEILLEUR_STOCK_PICKER" });
    expect(winners.filter((w) => w.code === "MEILLEUR_STOCK_PICKER")).toHaveLength(1);
  });

  it("attribue MEILLEUR_TRADER au meilleur taux de réussite parmi ceux ayant au moins 5 trades clôturés", () => {
    const winners = computeCloseOnlyWinners([
      summary({ userId: "user-a", winRatePct: 80 }),
      summary({ userId: "user-b", winRatePct: null }), // moins de 5 trades clôturés
    ]);
    expect(winners).toContainEqual({ userId: "user-a", code: "MEILLEUR_TRADER" });
    expect(winners.filter((w) => w.code === "MEILLEUR_TRADER")).toHaveLength(1);
  });

  it("n'attribue aucun superlatif si personne n'a de valeur exploitable", () => {
    const winners = computeCloseOnlyWinners([summary(), summary({ userId: "user-b" })]);
    expect(winners.some((w) => w.code === "MEILLEUR_STOCK_PICKER")).toBe(false);
    expect(winners.some((w) => w.code === "MEILLEUR_TRADER")).toBe(false);
    expect(winners.some((w) => w.code === "MEILLEUR_TIMING")).toBe(false);
  });

  it("attribue MEILLEUR_TIMING à tous les ex-aequo du meilleur gain post-achat", () => {
    const winners = computeCloseOnlyWinners([
      summary({ userId: "user-a", bestPostBuyGainPct: 25 }),
      summary({ userId: "user-b", bestPostBuyGainPct: 25 }),
      summary({ userId: "user-c", bestPostBuyGainPct: 10 }),
    ]);
    expect(winners.filter((w) => w.code === "MEILLEUR_TIMING")).toHaveLength(2);
  });

  it("retourne un tableau vide si aucun résumé n'est fourni", () => {
    expect(computeCloseOnlyWinners([])).toEqual([]);
  });
});
