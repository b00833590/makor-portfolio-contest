import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromotionStatus } from "@/generated/prisma/enums";

const dbMock = {
  position: { findMany: vi.fn() },
  transaction: { findMany: vi.fn() },
  performanceSnapshot: { findFirst: vi.fn(), create: vi.fn() },
  promotion: { findMany: vi.fn() },
  portfolio: { findMany: vi.fn() },
};

const refreshAssetPricesIfStaleMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/prices/pull-through", () => ({ refreshAssetPricesIfStale: refreshAssetPricesIfStaleMock }));

const { snapshotPortfolio, snapshotActivePromotions } = await import("./snapshot-service");

const NOW = new Date("2026-09-15T18:00:00Z");

function resetMocks() {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  refreshAssetPricesIfStaleMock.mockReset();
  refreshAssetPricesIfStaleMock.mockResolvedValue(new Map());
}

beforeEach(() => {
  resetMocks();
});

describe("snapshotPortfolio", () => {
  it("crée un snapshot à partir du cash disponible et des positions, sans rang (appel isolé)", async () => {
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
        rank: null,
      },
    });
  });

  it("utilise le prix rafraîchi plutôt que le dernier prix stocké s'il était périmé", async () => {
    dbMock.transaction.findMany.mockResolvedValue([]);
    dbMock.position.findMany.mockResolvedValue([
      {
        assetId: "asset-1",
        quantity: 400,
        avgEntryPrice: 100,
        asset: { id: "asset-1", prices: [{ price: 120 }] },
      },
    ]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);
    refreshAssetPricesIfStaleMock.mockResolvedValue(new Map([["asset-1", { price: 150, isStale: false }]]));

    await snapshotPortfolio("portfolio-1", 1_000_000, NOW);

    expect(refreshAssetPricesIfStaleMock).toHaveBeenCalledWith([{ id: "asset-1", prices: [{ price: 120 }] }]);
    const call = dbMock.performanceSnapshot.create.mock.calls[0][0];
    expect(call.data.totalValue).toBe(1_000_000 + 400 * 150);
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

  it("continue avec les autres portefeuilles si l'un d'eux échoue au calcul", async () => {
    dbMock.promotion.findMany.mockResolvedValue([{ id: "promo-1", initialCapital: 1_000_000 }]);
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-1" }, { id: "portfolio-2" }]);
    dbMock.transaction.findMany.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce([]);
    dbMock.position.findMany.mockResolvedValue([]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);

    const results = await snapshotActivePromotions(NOW);

    expect(results).toEqual([
      { portfolioId: "portfolio-1", status: "failed" },
      { portfolioId: "portfolio-2", status: "ok" },
    ]);
    expect(dbMock.performanceSnapshot.create).toHaveBeenCalledTimes(1);
  });

  it("classe les portefeuilles d'une même promotion par rendement cumulé et écrit le rang", async () => {
    dbMock.promotion.findMany.mockResolvedValue([{ id: "promo-1", initialCapital: 1_000_000 }]);
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-1" }, { id: "portfolio-2" }]);
    // portfolio-1 : 40 000 investis à +20% -> avantage ; portfolio-2 : aucune position.
    dbMock.transaction.findMany
      .mockResolvedValueOnce([{ type: "BUY", amount: 40_000 }])
      .mockResolvedValueOnce([]);
    dbMock.position.findMany
      .mockResolvedValueOnce([{ quantity: 400, avgEntryPrice: 100, asset: { prices: [{ price: 120 }] } }])
      .mockResolvedValueOnce([]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);

    await snapshotActivePromotions(NOW);

    const calls = dbMock.performanceSnapshot.create.mock.calls.map((call) => call[0].data);
    const portfolio1Call = calls.find((call) => call.portfolioId === "portfolio-1")!;
    const portfolio2Call = calls.find((call) => call.portfolioId === "portfolio-2")!;
    expect(portfolio1Call.rank).toBe(1);
    expect(portfolio2Call.rank).toBe(2);
  });

  it("ne classe que les portefeuilles calculés avec succès, pas ceux en échec", async () => {
    dbMock.promotion.findMany.mockResolvedValue([{ id: "promo-1", initialCapital: 1_000_000 }]);
    dbMock.portfolio.findMany.mockResolvedValue([{ id: "portfolio-1" }, { id: "portfolio-2" }]);
    dbMock.transaction.findMany.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce([]);
    dbMock.position.findMany.mockResolvedValue([]);
    dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);

    await snapshotActivePromotions(NOW);

    expect(dbMock.performanceSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ portfolioId: "portfolio-2", rank: 1 }),
    });
  });
});
