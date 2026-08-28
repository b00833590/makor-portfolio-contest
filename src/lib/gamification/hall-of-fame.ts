import "server-only";
import { db } from "@/lib/db";

/** Podium = 3 premiers. Sert de coupe pour les cartes "saison" ET pour savoir
 *  jusqu'où on remonte la photo de profil dans la vue all-time. */
const PODIUM_RANK = 3;

export interface HallOfFameEntryView {
  promotionId: string;
  promotionName: string;
  userId: string | null;
  userName: string;
  finalReturnPct: number;
  finalPnlEur: number;
  finalRank: number;
  /** Photo figée à la clôture. Renvoyée seulement pour le podium (rang ≤ 3)
   *  et pour les entrées du visiteur — les autres retombent sur les initiales,
   *  pour ne pas transférer des dizaines de data URLs sur la page all-time. */
  avatarUrl: string | null;
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
 * Historique figé : lecture de HallOfFameEntry (écrite une seule fois à la
 * clôture de chaque promotion — voir src/lib/promotion-lifecycle.ts). Aucun
 * recalcul, la performance n'y bouge plus. Pas de cache : page consultée
 * ponctuellement (pas de polling), requête indexée légère — un `unstable_cache`
 * ici ne faisait que servir une valeur périmée après une clôture (invalidation
 * par tag avalée en silence pendant un rendu RSC).
 *
 * Les photos (data URL, jusqu'à 400 Ko chacune) NE sont PAS ramenées pour
 * toutes les lignes — une 2e requête ciblée ne charge que le podium (rang ≤ 3)
 * et les entrées du visiteur, pour ne pas rejouer l'incident d'egress d'août
 * (dizaines de data URLs tirées de Postgres à chaque affichage).
 */
export async function getHallOfFame(viewerUserId?: string): Promise<HallOfFameData> {
  const [rows, avatarRows] = await Promise.all([
    db.hallOfFameEntry.findMany({ orderBy: { finalReturnPct: "desc" }, omit: { avatarUrl: true } }),
    db.hallOfFameEntry.findMany({
      where: {
        avatarUrl: { not: null },
        OR: [
          { finalRank: { lte: PODIUM_RANK } },
          ...(viewerUserId ? [{ userId: viewerUserId }] : []),
        ],
      },
      // finalRank est unique par promotion → clé stable (promotionId, finalRank).
      select: { promotionId: true, finalRank: true, avatarUrl: true },
    }),
  ]);
  const avatarByEntry = new Map(avatarRows.map((r) => [`${r.promotionId}:${r.finalRank}`, r.avatarUrl]));

  const entries: HallOfFameEntryView[] = rows.map((row) => ({
    promotionId: row.promotionId,
    promotionName: row.promotionName,
    userId: row.userId,
    userName: row.userName,
    finalReturnPct: Number(row.finalReturnPct),
    finalPnlEur: Number(row.finalPnlEur),
    finalRank: row.finalRank,
    avatarUrl: avatarByEntry.get(`${row.promotionId}:${row.finalRank}`) ?? null,
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
    if (entry.finalRank <= PODIUM_RANK) season.podium.push(entry);
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
