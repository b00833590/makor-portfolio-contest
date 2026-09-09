import { describe, it, expect } from "vitest";
import { computeLeaderboardHighlights } from "./leaderboard-highlights";
import type { LeaderboardRow } from "./get-leaderboard";

function makeRow(overrides: Partial<LeaderboardRow>): LeaderboardRow {
  return {
    userId: "u",
    name: "User",
    avatarUrl: null,
    portfolioId: "p",
    totalValue: 1000,
    cumulativeReturnPct: 0,
    rank: 1,
    previousRank: null,
    rankChange: 0,
    weeklyReturnPct: null,
    bestPosition: null,
    worstPosition: null,
    ...overrides,
  };
}

describe("computeLeaderboardHighlights", () => {
  it("returns all null for an empty leaderboard", () => {
    expect(computeLeaderboardHighlights([])).toEqual({ leader: null, bestMover: null, underperformer: null });
  });

  it("picks rank 1 as the leader", () => {
    const rows = [
      makeRow({ userId: "a", rank: 1, cumulativeReturnPct: 10 }),
      makeRow({ userId: "b", rank: 2, cumulativeReturnPct: 5 }),
    ];
    expect(computeLeaderboardHighlights(rows).leader?.userId).toBe("a");
  });

  it("picks the highest weeklyReturnPct as the best mover, ignoring nulls", () => {
    const rows = [
      makeRow({ userId: "a", rank: 1, weeklyReturnPct: 1 }),
      makeRow({ userId: "b", rank: 2, weeklyReturnPct: 8 }),
      makeRow({ userId: "c", rank: 3, weeklyReturnPct: null }),
    ];
    expect(computeLeaderboardHighlights(rows).bestMover?.userId).toBe("b");
  });

  it("returns a null best mover when nobody has a weekly return yet", () => {
    const rows = [makeRow({ userId: "a", weeklyReturnPct: null })];
    expect(computeLeaderboardHighlights(rows).bestMover).toBeNull();
  });

  it("picks the lowest cumulativeReturnPct as the underperformer", () => {
    const rows = [
      makeRow({ userId: "a", rank: 1, cumulativeReturnPct: 10 }),
      makeRow({ userId: "b", rank: 2, cumulativeReturnPct: -4 }),
      makeRow({ userId: "c", rank: 3, cumulativeReturnPct: 2 }),
    ];
    expect(computeLeaderboardHighlights(rows).underperformer?.userId).toBe("b");
  });

  it("returns a null underperformer for a single-participant leaderboard", () => {
    const rows = [makeRow({ userId: "a" })];
    expect(computeLeaderboardHighlights(rows).underperformer).toBeNull();
  });
});
