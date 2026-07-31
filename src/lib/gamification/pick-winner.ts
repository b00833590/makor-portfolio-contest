export interface RankableByReturn {
  cumulativeReturnPct: number;
}

export function pickWinner<T extends RankableByReturn>(entries: T[]): T | null {
  if (entries.length === 0) return null;
  return entries.reduce((best, entry) => (entry.cumulativeReturnPct > best.cumulativeReturnPct ? entry : best));
}
