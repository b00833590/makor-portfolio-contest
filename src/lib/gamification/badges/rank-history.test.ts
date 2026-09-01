import { describe, it, expect } from "vitest";
import { dedupeRankHistoryByDay } from "./rank-history";

const at = (iso: string, rank: number | null) => ({ timestamp: new Date(iso), rank });

describe("dedupeRankHistoryByDay", () => {
  it("garde un seul point par jour UTC — le premier vu (le plus récent)", () => {
    const history = [
      at("2026-09-15T18:00:00Z", 1),
      at("2026-09-15T09:00:00Z", 3),
      at("2026-09-14T20:00:00Z", 2),
      at("2026-09-14T08:00:00Z", 5),
    ];
    expect(dedupeRankHistoryByDay(history)).toEqual([
      at("2026-09-15T18:00:00Z", 1),
      at("2026-09-14T20:00:00Z", 2),
    ]);
  });

  it("laisse un historique déjà à un point par jour inchangé", () => {
    const history = [at("2026-09-15T12:00:00Z", 1), at("2026-09-14T12:00:00Z", 1)];
    expect(dedupeRankHistoryByDay(history)).toEqual(history);
  });

  it("retourne un tableau vide pour une entrée vide", () => {
    expect(dedupeRankHistoryByDay([])).toEqual([]);
  });
});
