/**
 * Module pur (pas de `server-only`) : `snapshotActivePromotions` peut écrire plusieurs
 * snapshots classés le même jour si le cron rejoue. Pour les badges qui comptent des
 * « journées » (INTOUCHABLE, REGNE), on réduit d'abord l'historique à un point par jour UTC.
 */

/** `rankHistory` est trié le plus récent en premier. Garde le premier point vu (donc le plus
 * récent) pour chaque date UTC `YYYY-MM-DD`. */
export function dedupeRankHistoryByDay<T extends { timestamp: Date }>(rankHistory: T[]): T[] {
  const seenDays = new Set<string>();
  const deduped: T[] = [];
  for (const point of rankHistory) {
    const day = point.timestamp.toISOString().slice(0, 10);
    if (seenDays.has(day)) continue;
    seenDays.add(day);
    deduped.push(point);
  }
  return deduped;
}
