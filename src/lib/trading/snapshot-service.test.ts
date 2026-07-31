import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromotionStatus } from "@/generated/prisma/enums";

const dbMock = {
  position: { findMany: vi.fn() },
  transaction: { findMany: vi.fn() },
  performanceSnapshot: { findFirst: vi.fn(), create: vi.fn() },
  promotion: { findMany: vi.fn() },
  portfolio: { findMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { snapshotPortfolio, snapshotActivePromotions } = await import("./snapshot-service");

const NOW = new Date("2026-09-15T18:00:00Z");

function resetMocks() {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
}

beforeEach(() => {
  resetMocks();
});

describe("snapshotPortfolio", () => {
  it("crée un snapshot à partir du cash disponible et des positions", async () => {
    dbMock.transaction.findMany.mockResolvedValue([{ type: "BUY", amount: 40_000 }]);
    dbMock.position.findMany.mockResolvedValue([
      {
        quantity: 400,
        avgEntryPrice: 100,
        asset: { prices: [{ price: 120 }] },
      },
    ]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);

    await snapshotPortfolio("portfolio-1", 1_000_000, NOW);

    expect(dbMock.performanceSnapshot.create).toHaveBeenCalledWith({
      data: {
        portfolioId: "portfolio-1",
        timestamp: NOW,
        totalValue: 960_000 + 48_000,
        dailyReturnPct: 0,
        cumulativeReturnPct: expect.any(Number),
      },
    });
  });

  it("utilise le dernier snapshot pour calculer le rendement journalier", async () => {
    dbMock.transaction.findMany.mockResolvedValue([]);
    dbMock.position.findMany.mockResolvedValue([]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue({ totalValue: 950_000 });

    await snapshotPortfolio("portfolio-1", 1_000_000, NOW);

    const call = dbMock.performanceSnapshot.create.mock.calls[0][0];
    expect(call.data.totalValue).toBe(1_000_000);
    expect(call.data.dailyReturnPct).toBeCloseTo(((1_000_000 - 950_000) / 950_000) * 100, 5);
  });
});

describe("snapshotActivePromotions", () => {
  it("crée un snapshot pour chaque portefeuille de chaque promotion active", async () => {
    dbMock.promotion.findMany.mockResolvedValue([{ id: "promo-1", initialCapital: 1_000_000 }]);
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-1" }, { id: "portfolio-2" }]);
    dbMock.transaction.findMany.mockResolvedValue([]);
    dbMock.position.findMany.mockResolvedValue([]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);

    const results = await snapshotActivePromotions(NOW);

    expect(dbMock.promotion.findMany).toHaveBeenCalledWith({
      where: { status: PromotionStatus.ACTIVE },
      select: { id: true, initialCapital: true },
    });
    expect(results).toEqual([
      { portfolioId: "portfolio-1", status: "ok" },
      { portfolioId: "portfolio-2", status: "ok" },
    ]);
    expect(dbMock.performanceSnapshot.create).toHaveBeenCalledTimes(2);
  });

  it("continue avec les autres portefeuilles si l'un d'eux échoue", async () => {
    dbMock.promotion.findMany.mockResolvedValue([{ id: "promo-1", initialCapital: 1_000_000 }]);
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-1" }, { id: "portfolio-2" }]);
    dbMock.transaction.findMany
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([]);
    dbMock.position.findMany.mockResolvedValue([]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);

    const results = await snapshotActivePromotions(NOW);

    expect(results).toEqual([
      { portfolioId: "portfolio-1", status: "failed" },
      { portfolioId: "portfolio-2", status: "ok" },
    ]);
  });
});
