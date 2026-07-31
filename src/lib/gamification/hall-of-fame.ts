import "server-only";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getLeaderboard } from "./get-leaderboard";
import { pickWinner } from "./pick-winner";

export interface SeasonWinner {
  userId: string;
  name: string;
  cumulativeReturnPct: number;
}

export interface SeasonResult {
  promotionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  winner: SeasonWinner | null;
}

export async function getHallOfFame(): Promise<SeasonResult[]> {
  const closedPromotions = await db.promotion.findMany({
    where: { status: PromotionStatus.CLOSED },
    orderBy: { endDate: "desc" },
  });

  const results: SeasonResult[] = [];
  for (const promotion of closedPromotions) {
    const leaderboard = await getLeaderboard(promotion.id, promotion.endDate);
    const winner = pickWinner(leaderboard);

    results.push({
      promotionId: promotion.id,
      name: promotion.name,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      winner: winner
        ? { userId: winner.userId, name: winner.name, cumulativeReturnPct: winner.cumulativeReturnPct }
        : null,
    });
  }

  return results;
}
