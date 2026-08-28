import "server-only";
import { db } from "@/lib/db";

export interface FrozenLeaderboardRow {
  userId: string | null;
  userName: string;
  finalRank: number;
  finalReturnPct: number;
  finalPnlEur: number;
}

/**
 * Classement définitif d'une promotion clôturée, lu depuis l'historique figé
 * (HallOfFameEntry, écrit une seule fois par finalizePromotionClosure). Aucun
 * recalcul : la performance n'y bouge plus.
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
  }));
}
