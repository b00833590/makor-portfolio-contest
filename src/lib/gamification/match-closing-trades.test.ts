import { describe, it, expect } from "vitest";
import { TransactionType } from "@/generated/prisma/enums";
import { buildTrades, type PositionForMatching, type TransactionForMatching } from "./match-closing-trades";

describe("buildTrades", () => {
  it("computes unrealized P&L for an open position from the current price", () => {
    const positions: PositionForMatching[] = [
      { id: "pos-1", assetId: "AAPL", avgEntryPrice: 100, quantity: 10, openedAt: new Date("2026-01-01"), closedAt: null },
    ];

    const trades = buildTrades(positions, [], new Map([["AAPL", 120]]));

    expect(trades).toEqual([
      { positionId: "pos-1", assetId: "AAPL", costBasisEur: 1000, exitValueEur: 1200, pnlEur: 200, pnlPct: 20, isOpen: true },
    ]);
  });

  it("computes realized P&L for a closed position using its SELL_FULL transaction", () => {
    const positions: PositionForMatching[] = [
      { id: "pos-1", assetId: "AAPL", avgEntryPrice: 100, quantity: 0, openedAt: new Date("2026-01-01"), closedAt: new Date("2026-01-05") },
    ];
    const transactions: TransactionForMatching[] = [
      { assetId: "AAPL", type: TransactionType.SELL_FULL, price: 90, quantity: 10, createdAt: new Date("2026-01-05") },
    ];

    const trades = buildTrades(positions, transactions, new Map());

    expect(trades).toEqual([
      { positionId: "pos-1", assetId: "AAPL", costBasisEur: 1000, exitValueEur: 900, pnlEur: -100, pnlPct: -10, isOpen: false },
    ]);
  });

  it("matches repeated buy/sell cycles on the same asset in FIFO order", () => {
    const positions: PositionForMatching[] = [
      { id: "pos-1", assetId: "AAPL", avgEntryPrice: 100, quantity: 0, openedAt: new Date("2026-01-01"), closedAt: new Date("2026-01-03") },
      { id: "pos-2", assetId: "AAPL", avgEntryPrice: 200, quantity: 0, openedAt: new Date("2026-01-04"), closedAt: new Date("2026-01-06") },
    ];
    const transactions: TransactionForMatching[] = [
      { assetId: "AAPL", type: TransactionType.SELL_FULL, price: 150, quantity: 5, createdAt: new Date("2026-01-03") },
      { assetId: "AAPL", type: TransactionType.SELL_FULL, price: 180, quantity: 5, createdAt: new Date("2026-01-06") },
    ];

    const trades = buildTrades(positions, transactions, new Map());

    expect(trades.find((t) => t.positionId === "pos-1")).toMatchObject({ exitValueEur: 750, pnlEur: 250 });
    expect(trades.find((t) => t.positionId === "pos-2")).toMatchObject({ exitValueEur: 900, pnlEur: -100 });
  });

  it("skips a closed position with no matching SELL_FULL transaction", () => {
    const positions: PositionForMatching[] = [
      { id: "pos-1", assetId: "AAPL", avgEntryPrice: 100, quantity: 0, openedAt: new Date("2026-01-01"), closedAt: new Date("2026-01-05") },
    ];

    expect(buildTrades(positions, [], new Map())).toEqual([]);
  });

  it("falls back to the average entry price when no current price is known for an open position", () => {
    const positions: PositionForMatching[] = [
      { id: "pos-1", assetId: "BTC", avgEntryPrice: 100, quantity: 2, openedAt: new Date("2026-01-01"), closedAt: null },
    ];

    const trades = buildTrades(positions, [], new Map());

    expect(trades[0]).toMatchObject({ pnlEur: 0, pnlPct: 0 });
  });
});
