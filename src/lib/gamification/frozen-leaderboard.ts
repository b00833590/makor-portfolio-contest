import "server-only";
import { db } from "@/lib/db";

export interface FrozenLeaderboardRow {
  userId: string | null;
  userName: string;
  finalRank: number;
  finalReturnPct: number;
  finalPnlEur: number;
  /** Photo figée à la clôture (data URL) ou null. */
  avatarUrl: string | null;
}

/**
 * Classement définitif d'une promotion clôturée, lu depuis l'historique figé
 * (HallOfFameEntry, écrit une seule fois par finalizePromotionClosure). Aucun
 * recalcul : la performance n'y bouge plus.
 *
 * Non caché exprès : le self-heal de /resultats relit ce classement juste après
 * avoir rejoué la finalisation — un cache renverrait la valeur vide périmée.
 * ponytail: renvoie tous les avatars (data URLs) pour la promotion ; OK pour une
 * cohorte de stagiaires (~40, pas de polling sur ces pages). Si les cohortes
 * grossissent ou que les pages figées sont rechargées en boucle, mettre en
 * cache la partie avatars par promotionId (les lignes figées ne changent plus).
 */
export async function getFrozenLeaderboard(promotionId: string): Promise<FrozenLeaderboardRow[]> {
  const rows = await db.hallOfFameEntry.findMany({
    where: { promotionId },
    orderBy: { finalRank: "asc" },
  });
  return rows.map((row) => ({
    userId: row.userId,
    userName: row.userName,
    finalRank: row.finalRank,
    finalReturnPct: Number(row.finalReturnPct),
    finalPnlEur: Number(row.finalPnlEur),
    avatarUrl: row.avatarUrl,
  }));
}
