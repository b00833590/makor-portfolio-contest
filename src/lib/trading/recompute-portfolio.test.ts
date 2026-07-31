import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransactionType } from "@/generated/prisma/enums";

const dbMock = {
  transaction: { findMany: vi.fn() },
  position: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(async (callback: (tx: typeof dbMock) => Promise<void>) => callback(dbMock)),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { recomputePortfolioPositions } = await import("./recompute-portfolio");

function makeTx(overrides: Record<string, unknown>) {
  return {
    id: "tx-1",
    portfolioId: "portfolio-1",
    assetId: "asset-1",
    changeSessionId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  dbMock.transaction.findMany.mockReset();
  dbMock.position.deleteMany.mockReset();
  dbMock.position.createMany.mockReset();
  dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<void>) => callback(dbMock));
});

describe("recomputePortfolioPositions", () => {
  it("rebuilds a single open position from a BUY", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: TransactionType.BUY, quantity: 10, price: 100, createdAt: new Date("2026-01-01") }),
    ]);

    await recomputePortfolioPositions("portfolio-1");

    expect(dbMock.position.deleteMany).toHaveBeenCalledWith({ where: { portfolioId: "portfolio-1" } });
    expect(dbMock.position.createMany).toHaveBeenCalledWith({
      data: [
        {
          portfolioId: "portfolio-1",
          assetId: "asset-1",
          quantity: 10,
          avgEntryPrice: 100,
          openedAt: new Date("2026-01-01"),
        },
      ],
    });
  });

  it("computes a weighted average entry price after a BUY then INCREASE", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: TransactionType.BUY, quantity: 10, price: 100, createdAt: new Date("2026-01-01") }),
      makeTx({ type: TransactionType.INCREASE, quantity: 10, price: 200, createdAt: new Date("2026-01-02") }),
    ]);

    await recomputePortfolioPositions("portfolio-1");

    const [{ data }] = dbMock.position.createMany.mock.calls[0];
    expect(data[0].quantity).toBe(20);
    expect(data[0].avgEntryPrice).toBe(150); // (10*100 + 10*200) / 20
  });

  it("reduces quantity after a SELL_PARTIAL without closing the position", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: TransactionType.BUY, quantity: 10, price: 100, createdAt: new Date("2026-01-01") }),
      makeTx({ type: TransactionType.SELL_PARTIAL, quantity: 4, price: 120, createdAt: new Date("2026-01-02") }),
    ]);

    await recomputePortfolioPositions("portfolio-1");

    const [{ data }] = dbMock.position.createMany.mock.calls[0];
    expect(data[0].quantity).toBe(6);
    expect(data[0].avgEntryPrice).toBe(100); // le prix moyen ne change pas lors d'une vente
  });

  it("excludes a fully closed position (SELL_FULL) from the rebuilt positions", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: TransactionType.BUY, quantity: 10, price: 100, createdAt: new Date("2026-01-01") }),
      makeTx({ type: TransactionType.SELL_FULL, quantity: 10, price: 120, createdAt: new Date("2026-01-02") }),
    ]);

    await recomputePortfolioPositions("portfolio-1");

    expect(dbMock.position.createMany).not.toHaveBeenCalled();
  });

  it("reopens a position when a later BUY follows a full sell of the same asset", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: TransactionType.BUY, quantity: 10, price: 100, createdAt: new Date("2026-01-01") }),
      makeTx({ type: TransactionType.SELL_FULL, quantity: 10, price: 120, createdAt: new Date("2026-01-02") }),
      makeTx({ type: TransactionType.BUY, quantity: 5, price: 90, createdAt: new Date("2026-01-03") }),
    ]);

    await recomputePortfolioPositions("portfolio-1");

    const [{ data }] = dbMock.position.createMany.mock.calls[0];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ quantity: 5, avgEntryPrice: 90, openedAt: new Date("2026-01-03") });
  });

  it("ignores an INCREASE or SELL_PARTIAL with no prior position rather than throwing", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      makeTx({ type: TransactionType.INCREASE, quantity: 10, price: 100, createdAt: new Date("2026-01-01") }),
    ]);

    await expect(recomputePortfolioPositions("portfolio-1")).resolves.not.toThrow();
    expect(dbMock.position.createMany).not.toHaveBeenCalled();
  });

  it("handles multiple assets independently", async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      makeTx({ assetId: "asset-1", type: TransactionType.BUY, quantity: 10, price: 100, createdAt: new Date("2026-01-01") }),
      makeTx({ assetId: "asset-2", type: TransactionType.BUY, quantity: 3, price: 50, createdAt: new Date("2026-01-02") }),
    ]);

    await recomputePortfolioPositions("portfolio-1");

    const [{ data }] = dbMock.position.createMany.mock.calls[0];
    expect(data).toHaveLength(2);
    expect(data.map((p: { assetId: string }) => p.assetId).sort()).toEqual(["asset-1", "asset-2"]);
  });
});
