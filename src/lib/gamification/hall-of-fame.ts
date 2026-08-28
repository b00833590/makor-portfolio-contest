import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export interface HallOfFameEntryView {
  promotionId: string;
  promotionName: string;
  userId: string | null;
  userName: string;
  finalReturnPct: number;
  finalPnlEur: number;
  finalRank: number;
  closedAt: Date;
}

export interface HallOfFameSeason {
  promotionId: string;
  promotionName: string;
  closedAt: Date;
  podium: HallOfFameEntryView[];
}

export interface HallOfFameParticipation {
  userName: string;
  count: number;
  bestReturnPct: number;
}

export interface HallOfFameData {
  /** Toutes les participations, meilleure performance de tous les temps en tête. */
  entries: HallOfFameEntryView[];
  /** Podiums (rang 1-3) groupés par saison, la plus récente d'abord. */
  seasons: HallOfFameSeason[];
  /** Nombre de participations et meilleure perf par personne. */
  participations: HallOfFameParticipation[];
}

/**
 * Historique figé : lecture unique de HallOfFameEntry (écrite une seule fois
 * à la clôture de chaque promotion — voir src/lib/promotion-lifecycle.ts).
 * Aucun recalcul, la performance n'y bouge plus.
 */
export async function getHallOfFame(): Promise<HallOfFameData> {
  const rows = await db.hallOfFameEntry.findMany({ orderBy: { finalReturnPct: "desc" } });

  const entries: HallOfFameEntryView[] = rows.map((row) => ({
    promotionId: row.promotionId,
    promotionName: row.promotionName,
    userId: row.userId,
    userName: row.userName,
    finalReturnPct: Number(row.finalReturnPct),
    finalPnlEur: Number(row.finalPnlEur),
    finalRank: row.finalRank,
    closedAt: row.closedAt,
  }));

  const seasonMap = new Map<string, HallOfFameSeason>();
  for (const entry of entries) {
    let season = seasonMap.get(entry.promotionId);
    if (!season) {
      season = {
        promotionId: entry.promotionId,
        promotionName: entry.promotionName,
        closedAt: entry.closedAt,
        podium: [],
      };
      seasonMap.set(entry.promotionId, season);
    }
    if (entry.finalRank <= 3) season.podium.push(entry);
  }
  const seasons = [...seasonMap.values()]
    .map((season) => ({ ...season, podium: [...season.podium].sort((a, b) => a.finalRank - b.finalRank) }))
    .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());

  // Clé d'agrégation = identité du compte (userId), pas le nom affiché : le
  // nom d'un compte supprimé peut être réattribué à une autre personne, deux
  // participations distinctes ne doivent pas fusionner. `userName` reste
  // exposé pour l'affichage.
  const participationMap = new Map<string, HallOfFameParticipation>();
  for (const entry of entries) {
    const key = entry.userId ?? entry.userName;
    const current = participationMap.get(key);
    if (!current) {
      participationMap.set(key, {
        userName: entry.userName,
        count: 1,
        bestReturnPct: entry.finalReturnPct,
      });
    } else {
      participationMap.set(key, {
        userName: current.userName,
        count: current.count + 1,
        bestReturnPct: Math.max(current.bestReturnPct, entry.finalReturnPct),
      });
    }
  }
  const participations = [...participationMap.values()].sort((a, b) => b.bestReturnPct - a.bestReturnPct);

  return { entries, seasons, participations };
}

/**
 * Mise en cache, tag `hall-of-fame` — invalidé uniquement à la clôture d'une
 * promotion (finalizePromotionClosure). La fenêtre de revalidation n'est
 * qu'un filet.
 */
export const getCachedHallOfFame = unstable_cache(getHallOfFame, ["hall-of-fame"], {
  revalidate: 3600,
  tags: ["hall-of-fame"],
});
