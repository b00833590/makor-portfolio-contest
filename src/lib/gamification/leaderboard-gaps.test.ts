import { describe, it, expect } from "vitest";
import { computeLeaderboardGaps } from "./leaderboard-gaps";

describe("computeLeaderboardGaps", () => {
  it("returns null toLeader and toAhead for the leader, and null toBehind for the last place", () => {
    const rows = [
      { totalValue: 1_200_000, cumulativeReturnPct: 20 },
      { totalValue: 1_100_000, cumulativeReturnPct: 10 },
      { totalValue: 1_000_000, cumulativeReturnPct: 0 },
    ];

    const gaps = computeLeaderboardGaps(rows);

    expect(gaps[0].toLeader).toBeNull();
    expect(gaps[0].toAhead).toBeNull();
    expect(gaps[0].toBehind).toEqual({ eur: 100_000, pts: 10 });

    expect(gaps[2].toBehind).toBeNull();
  });

  it("computes the gap to the leader for a non-leader row", () => {
    const rows = [
      { totalValue: 1_200_000, cumulativeReturnPct: 20 },
      { totalValue: 1_050_000, cumulativeReturnPct: 5 },
    ];

    const gaps = computeLeaderboardGaps(rows);

    expect(gaps[1].toLeader).toEqual({ eur: 150_000, pts: 15 });
  });

  it("computes the gap to the participant directly ahead and behind for a middle row", () => {
    const rows = [
      { totalValue: 1_200_000, cumulativeReturnPct: 20 },
      { totalValue: 1_100_000, cumulativeReturnPct: 10 },
      { totalValue: 1_050_000, cumulativeReturnPct: 5 },
      { totalValue: 900_000, cumulativeReturnPct: -10 },
    ];

    const gaps = computeLeaderboardGaps(rows);

    expect(gaps[2].toAhead).toEqual({ eur: 50_000, pts: 5 });
    expect(gaps[2].toBehind).toEqual({ eur: 150_000, pts: 15 });
    expect(gaps[2].toLeader).toEqual({ eur: 150_000, pts: 15 });
  });

  it("returns an empty array for an empty leaderboard", () => {
    expect(computeLeaderboardGaps([])).toEqual([]);
  });

  it("returns all-null gaps for a single-participant leaderboard", () => {
    const gaps = computeLeaderboardGaps([{ totalValue: 1_000_000, cumulativeReturnPct: 0 }]);

    expect(gaps).toEqual([{ toLeader: null, toAhead: null, toBehind: null }]);
  });

  it("handles tied values with a zero gap rather than a negative one", () => {
    const rows = [
      { totalValue: 1_000_000, cumulativeReturnPct: 0 },
      { totalValue: 1_000_000, cumulativeReturnPct: 0 },
    ];

    const gaps = computeLeaderboardGaps(rows);

    expect(gaps[1].toLeader).toEqual({ eur: 0, pts: 0 });
  });
});
