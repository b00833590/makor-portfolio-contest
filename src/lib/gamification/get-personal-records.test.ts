import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  performanceSnapshot: { findFirst: vi.fn() },
  position: { findMany: vi.fn() },
  transaction: { findMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { getPersonalRecords } = await import("./get-personal-records");

beforeEach(() => {
  Object.values(dbMock).forEach((group) => Object.values(group).forEach((fn) => fn.mockReset()));
  dbMock.performanceSnapshot.findFirst.mockResolvedValue(null);
  dbMock.position.findMany.mockResolvedValue([]);
  dbMock.transaction.findMany.mockResolvedValue([]);
});

describe("getPersonalRecords", () => {
  it("retourne des records nuls sans historique", async () => {
    const records = await getPersonalRecords("portfolio-1");
    expect(records).toEqual({
      bestDayPct: null,
      bestDayDate: null,
      bestTradePct: null,
      bestTradeAssetSymbol: null,
      longestHoldDays: null,
      longestHoldAssetSymbol: null,
    });
  });

  it("expose la meilleure journée à partir du snapshot au dailyReturnPct le plus élevé", async () => {
    const bestDay = new Date("2026-09-05T00:00:00Z");
    dbMock.performanceSnapshot.findFirst.mockResolvedValue({ dailyReturnPct: 12.5, timestamp: bestDay });

    const records = await getPersonalRecords("portfolio-1");

    expect(records.bestDayPct).toBe(12.5);
    expect(records.bestDayDate).toEqual(bestDay);
  });

  it("expose le meilleur trade (clôturé) et son symbole", async () => {
    dbMock.position.findMany.mockResolvedValue([
      {
        id: "pos-1",
        assetId: "asset-a",
        avgEntryPrice: 100,
        quantity: 0,
        openedAt: new Date("2026-09-01T00:00:00Z"),
        closedAt: new Date("2026-09-03T00:00:00Z"),
        asset: { symbol: "AAPL", prices: [] },
      },
    ]);
    dbMock.transaction.findMany.mockResolvedValue([
      { assetId: "asset-a", type: "SELL_FULL", price: 130, quantity: 10, createdAt: new Date("2026-09-03T00:00:00Z") },
    ]);

    const records = await getPersonalRecords("portfolio-1");

    expect(records.bestTradePct).toBeCloseTo(30, 5);
    expect(records.bestTradeAssetSymbol).toBe("AAPL");
  });

  it("expose la position détenue le plus longtemps", async () => {
    const now = new Date();
    dbMock.position.findMany.mockResolvedValue([
      {
        id: "pos-short",
        assetId: "asset-a",
        avgEntryPrice: 100,
        quantity: 1,
        openedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        closedAt: null,
        asset: { symbol: "COURT", prices: [{ price: 100 }] },
      },
      {
        id: "pos-long",
        assetId: "asset-b",
        avgEntryPrice: 50,
        quantity: 1,
        openedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        closedAt: null,
        asset: { symbol: "LONG", prices: [{ price: 50 }] },
      },
    ]);

    const records = await getPersonalRecords("portfolio-1");

    expect(records.longestHoldAssetSymbol).toBe("LONG");
    expect(records.longestHoldDays).toBe(20);
  });
});
