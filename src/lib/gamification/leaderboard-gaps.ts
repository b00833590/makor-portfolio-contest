export interface Gap {
  eur: number;
  /** Points de pourcentage (différence de rendement cumulé, pas un ratio). */
  pts: number;
}

export interface LeaderboardGaps {
  /** `null` pour le leader lui-même — il n'y a personne au-dessus. */
  toLeader: Gap | null;
  /** `null` pour le leader — pas de participant devant. */
  toAhead: Gap | null;
  /** `null` pour la dernière place — pas de participant derrière. */
  toBehind: Gap | null;
}

export interface RankedEntry {
  totalValue: number;
  cumulativeReturnPct: number;
}

function gapBetween(reference: RankedEntry, row: RankedEntry): Gap {
  return { eur: reference.totalValue - row.totalValue, pts: reference.cumulativeReturnPct - row.cumulativeReturnPct };
}

/**
 * Écart de chaque participant avec le leader, celui juste devant, et celui
 * juste derrière — `rows` doit déjà être trié par rang croissant (voir
 * get-leaderboard.ts). Pure et testable séparément du classement lui-même :
 * ce n'est qu'une transformation d'un tableau déjà calculé, pas une requête
 * supplémentaire.
 */
export function computeLeaderboardGaps(rows: RankedEntry[]): LeaderboardGaps[] {
  const leader = rows[0];

  return rows.map((row, index) => ({
    toLeader: index === 0 ? null : gapBetween(leader, row),
    toAhead: index === 0 ? null : gapBetween(rows[index - 1], row),
    toBehind: index === rows.length - 1 ? null : gapBetween(row, rows[index + 1]),
  }));
}
