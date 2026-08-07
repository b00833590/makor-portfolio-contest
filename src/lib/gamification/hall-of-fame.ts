import "server-only";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
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

/**
 * Le Hall of Fame doit rester un enregistrement historique figé : il ne doit
 * jamais dépendre de `getLeaderboard`, qui recalcule la valeur des positions
 * ENCORE OUVERTES au prix de marché ACTUEL. Pour une saison clôturée, ce
 * serait faire fluctuer indéfiniment le classement (et potentiellement
 * changer le vainqueur désigné) au gré du marché, des mois après la fin du
 * concours. On lit donc le dernier `PerformanceSnapshot` de chaque
 * portefeuille (pré-calculé au moment de la clôture), jamais un recalcul live.
 */
export async function getHallOfFame(): Promise<SeasonResult[]> {
  const closedPromotions = await db.promotion.findMany({
    where: { status: PromotionStatus.CLOSED },
    orderBy: { endDate: "desc" },
  });

  const results: SeasonResult[] = [];
  for (const promotion of closedPromotions) {
    const portfolios = await db.portfolio.findMany({
      where: { promotionId: promotion.id },
      include: { user: { select: { id: true, name: true } } },
    });

    const finalEntries = await Promise.all(
      portfolios.map(async (portfolio) => {
        const finalSnapshot = await db.performanceSnapshot.findFirst({
          where: { portfolioId: portfolio.id, timestamp: { lte: promotion.endDate } },
          orderBy: { timestamp: "desc" },
        });
        if (!finalSnapshot) return null;
        return {
          userId: portfolio.user.id,
          name: portfolio.user.name,
          cumulativeReturnPct: Number(finalSnapshot.cumulativeReturnPct),
        };
      }),
    );

    const winner = pickWinner(finalEntries.filter((entry): entry is SeasonWinner => entry !== null));

    results.push({
      promotionId: promotion.id,
      name: promotion.name,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      winner,
    });
  }

  return results;
}
