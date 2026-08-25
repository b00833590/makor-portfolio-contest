import "server-only";
import { unstable_cache } from "next/cache";
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
    const userByPortfolioId = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio.user]));

    // Un seul aller-retour pour tous les portefeuilles de la saison (au lieu
    // d'un findFirst par portefeuille) — même pattern `distinct` que le
    // dernier prix par actif dans ingest.ts.
    const finalSnapshots = await db.performanceSnapshot.findMany({
      where: { portfolioId: { in: portfolios.map((portfolio) => portfolio.id) }, timestamp: { lte: promotion.endDate } },
      orderBy: { timestamp: "desc" },
      distinct: ["portfolioId"],
    });

    const finalEntries = finalSnapshots.map((snapshot) => {
      const user = userByPortfolioId.get(snapshot.portfolioId)!;
      return { userId: user.id, name: user.name, cumulativeReturnPct: Number(snapshot.cumulativeReturnPct) };
    });

    const winner = pickWinner(finalEntries);

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

/**
 * Mis en cache et taggé `hall-of-fame` : ces données sont un historique figé
 * (voir le commentaire sur {@link getHallOfFame}), invalidées uniquement
 * quand une promotion passe à CLOSED (`setPromotionStatus`,
 * admin/promotions/actions.ts) — jamais par le passage du temps. La fenêtre
 * de revalidation n'est donc qu'un filet de sécurité, sa durée importe peu.
 */
export const getCachedHallOfFame = unstable_cache(getHallOfFame, ["hall-of-fame"], {
  revalidate: 3600,
  tags: ["hall-of-fame"],
});
