import type { LeaderboardRow } from "./get-leaderboard";

export interface LeaderboardHighlights {
  leader: LeaderboardRow | null;
  bestMover: LeaderboardRow | null;
  underperformer: LeaderboardRow | null;
}

/**
 * Leader (rang 1), meilleure progression sur 7 jours, et sous-performance
 * (rendement cumulé le plus bas) — dérivés du classement déjà calculé, sans
 * requête supplémentaire. `rows` doit déjà être trié par rang croissant (voir
 * get-leaderboard.ts). Utilisé par la vue d'ensemble d'un concours dans
 * l'espace Directeur.
 */
export function computeLeaderboardHighlights(rows: LeaderboardRow[]): LeaderboardHighlights {
  if (rows.length === 0) {
    return { leader: null, bestMover: null, underperformer: null };
  }

  const leader = rows[0];

  const withWeeklyReturn = rows.filter((row) => row.weeklyReturnPct !== null);
  const bestMover =
    withWeeklyReturn.length > 0
      ? withWeeklyReturn.reduce((best, row) => (row.weeklyReturnPct! > best.weeklyReturnPct! ? row : best))
      : null;

  const underperformer =
    rows.length > 1
      ? rows.reduce((worst, row) => (row.cumulativeReturnPct < worst.cumulativeReturnPct ? row : worst))
      : null;

  return { leader, bestMover, underperformer };
}
