import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  portfolio: { findMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { getPromotionPerformanceSeries } = await import("./get-promotion-performance-series");

beforeEach(() => {
  dbMock.portfolio.findMany.mockReset();
});

describe("getPromotionPerformanceSeries", () => {
  it("merges each participant's snapshots into one point per date", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([
      {
        user: { name: "Alice" },
        snapshots: [
          { timestamp: new Date("2026-09-14T18:00:00Z"), totalValue: 1_020_000, cumulativeReturnPct: 2, dailyReturnPct: 1 },
          { timestamp: new Date("2026-09-15T18:00:00Z"), totalValue: 1_050_000, cumulativeReturnPct: 5, dailyReturnPct: 3 },
        ],
      },
      {
        user: { name: "Bob" },
        snapshots: [
          { timestamp: new Date("2026-09-15T18:00:00Z"), totalValue: 1_030_000, cumulativeReturnPct: 3, dailyReturnPct: 3 },
        ],
      },
    ]);

    const series = await getPromotionPerformanceSeries("promo-1");

    expect(series.participantNames).toEqual(["Alice", "Bob"]);
    expect(series.points).toEqual([
      {
        date: "2026-09-14",
        label: expect.any(String),
        values: { Alice: { totalValue: 1_020_000, cumulativeReturnPct: 2, dailyReturnPct: 1 } },
      },
      {
        date: "2026-09-15",
        label: expect.any(String),
        values: {
          Alice: { totalValue: 1_050_000, cumulativeReturnPct: 5, dailyReturnPct: 3 },
          Bob: { totalValue: 1_030_000, cumulativeReturnPct: 3, dailyReturnPct: 3 },
        },
      },
    ]);
  });

  it("returns an empty series when no portfolio has snapshots yet", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([{ user: { name: "Alice" }, snapshots: [] }]);

    const series = await getPromotionPerformanceSeries("promo-1");

    expect(series.points).toEqual([]);
    expect(series.participantNames).toEqual(["Alice"]);
  });

  it("sorts points chronologically regardless of portfolio iteration order", async () => {
    dbMock.portfolio.findMany.mockResolvedValue([
      {
        user: { name: "Alice" },
        snapshots: [
          { timestamp: new Date("2026-09-16T18:00:00Z"), totalValue: 1_060_000, cumulativeReturnPct: 6, dailyReturnPct: 1 },
          { timestamp: new Date("2026-09-14T18:00:00Z"), totalValue: 1_020_000, cumulativeReturnPct: 2, dailyReturnPct: 2 },
        ],
      },
    ]);

    const series = await getPromotionPerformanceSeries("promo-1");

    expect(series.points.map((point) => point.date)).toEqual(["2026-09-14", "2026-09-16"]);
  });
});
