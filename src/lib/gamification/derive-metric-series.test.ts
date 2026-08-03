import { describe, it, expect } from "vitest";
import { deriveMetricSeries } from "./derive-metric-series";
import type { PromotionPerformancePoint } from "./get-promotion-performance-series";

const points: PromotionPerformancePoint[] = [
  {
    date: "2026-09-14",
    label: "14/09/2026",
    values: {
      Alice: { totalValue: 1_020_000, cumulativeReturnPct: 2, dailyReturnPct: 1 },
      Bob: { totalValue: 1_050_000, cumulativeReturnPct: 5, dailyReturnPct: 2 },
    },
  },
  {
    date: "2026-09-15",
    label: "15/09/2026",
    values: {
      Alice: { totalValue: 1_080_000, cumulativeReturnPct: 8, dailyReturnPct: 6 },
      Bob: { totalValue: 1_040_000, cumulativeReturnPct: 4, dailyReturnPct: -1 },
    },
  },
];

const INITIAL_CAPITAL = 1_000_000;

describe("deriveMetricSeries", () => {
  it("projects totalValue for each participant", () => {
    const result = deriveMetricSeries(points, "totalValue", INITIAL_CAPITAL);
    expect(result[0]).toEqual({ date: "2026-09-14", label: "14/09/2026", Alice: 1_020_000, Bob: 1_050_000 });
  });

  it("projects cumulativeReturnPct for each participant", () => {
    const result = deriveMetricSeries(points, "cumulativeReturnPct", INITIAL_CAPITAL);
    expect(result[1]).toEqual({ date: "2026-09-15", label: "15/09/2026", Alice: 8, Bob: 4 });
  });

  it("derives the euro gain from totalValue minus initial capital", () => {
    const result = deriveMetricSeries(points, "gainEur", INITIAL_CAPITAL);
    expect(result[0]).toEqual({ date: "2026-09-14", label: "14/09/2026", Alice: 20_000, Bob: 50_000 });
  });

  it("projects dailyReturnPct for each participant", () => {
    const result = deriveMetricSeries(points, "dailyReturnPct", INITIAL_CAPITAL);
    expect(result[1]).toEqual({ date: "2026-09-15", label: "15/09/2026", Alice: 6, Bob: -1 });
  });

  it("derives rank from cumulativeReturnPct, best first", () => {
    const result = deriveMetricSeries(points, "rank", INITIAL_CAPITAL);
    // Jour 1 : Bob (5%) devant Alice (2%)
    expect(result[0]).toEqual({ date: "2026-09-14", label: "14/09/2026", Bob: 1, Alice: 2 });
    // Jour 2 : Alice (8%) devant Bob (4%)
    expect(result[1]).toEqual({ date: "2026-09-15", label: "15/09/2026", Alice: 1, Bob: 2 });
  });

  it("omits a participant on a date with no snapshot", () => {
    const sparsePoints: PromotionPerformancePoint[] = [
      {
        date: "2026-09-14",
        label: "14/09/2026",
        values: { Alice: { totalValue: 1_010_000, cumulativeReturnPct: 1, dailyReturnPct: 1 } },
      },
    ];
    const result = deriveMetricSeries(sparsePoints, "totalValue", INITIAL_CAPITAL);
    expect(result[0]).toEqual({ date: "2026-09-14", label: "14/09/2026", Alice: 1_010_000 });
    expect(result[0].Bob).toBeUndefined();
  });
});
