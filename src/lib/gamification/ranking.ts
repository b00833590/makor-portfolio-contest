export interface RankableEntry {
  portfolioId: string;
  cumulativeReturnPct: number;
}

export function rankEntries<T extends RankableEntry>(entries: T[]): Array<T & { rank: number }> {
  return [...entries]
    .sort((a, b) => b.cumulativeReturnPct - a.cumulativeReturnPct)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** Nombre de places gagnées (positif) ou perdues (négatif) depuis le rang précédent. */
export function computeRankChange(currentRank: number, previousRank: number | null): number {
  if (previousRank === null) return 0;
  return previousRank - currentRank;
}
