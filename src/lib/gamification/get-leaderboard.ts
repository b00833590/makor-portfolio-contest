import "server-only";
import { db } from "@/lib/db";
import { rankEntries, computeRankChange } from "./ranking";

export interface LeaderboardRow {
  userId: string;
  name: string;
  portfolioId: string;
  totalValue: number;
  cumulativeReturnPct: number;
  rank: number;
  previousRank: number | null;
  rankChange: number;
  /** Rendement sur les 7 derniers jours, ou null si l'historique est trop court. */
  weeklyReturnPct: number | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function getLeaderboard(promotionId: string, now: Date = new Date()): Promise<LeaderboardRow[]> {
  const promotion = await db.promotion.findUniqueOrThrow({ where: { id: promotionId } });
  const initialCapital = Number(promotion.initialCapital);

  const portfolios = await db.portfolio.findMany({
    where: { promotionId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  const snapshotsByPortfolio = new Map(
    await Promise.all(
      portfolios.map(async (portfolio) => {
        const [latest, weekAgo] = await Promise.all([
          db.performanceSnapshot.findFirst({
            where: { portfolioId: portfolio.id, timestamp: { lte: now } },
            orderBy: { timestamp: "desc" },
          }),
          db.performanceSnapshot.findFirst({
            where: { portfolioId: portfolio.id, timestamp: { lte: sevenDaysAgo } },
            orderBy: { timestamp: "desc" },
          }),
        ]);
        return [portfolio.id, { portfolio, latest, weekAgo }] as const;
      }),
    ),
  );

  const currentEntries = portfolios.map((portfolio) => {
    const { latest } = snapshotsByPortfolio.get(portfolio.id)!;
    return {
      portfolioId: portfolio.id,
      cumulativeReturnPct: latest ? Number(latest.cumulativeReturnPct) : 0,
      totalValue: latest ? Number(latest.totalValue) : initialCapital,
    };
  });

  const previousEntries = portfolios
    .map((portfolio) => ({ portfolio, weekAgo: snapshotsByPortfolio.get(portfolio.id)!.weekAgo }))
    .filter(({ weekAgo }) => weekAgo !== null)
    .map(({ portfolio, weekAgo }) => ({
      portfolioId: portfolio.id,
      cumulativeReturnPct: Number(weekAgo!.cumulativeReturnPct),
    }));

  const rankedCurrent = rankEntries(currentEntries);
  const rankedPrevious = rankEntries(previousEntries);
  const previousRankByPortfolio = new Map(rankedPrevious.map((entry) => [entry.portfolioId, entry.rank]));

  return rankedCurrent
    .map((entry) => {
      const { portfolio, weekAgo, latest } = snapshotsByPortfolio.get(entry.portfolioId)!;
      const previousRank = previousRankByPortfolio.get(entry.portfolioId) ?? null;
      const weekAgoValue = weekAgo ? Number(weekAgo.totalValue) : null;
      const weeklyReturnPct =
        weekAgoValue && latest && weekAgoValue !== 0
          ? ((Number(latest.totalValue) - weekAgoValue) / weekAgoValue) * 100
          : null;

      return {
        userId: portfolio.user.id,
        name: portfolio.user.name ?? portfolio.user.email,
        portfolioId: portfolio.id,
        totalValue: entry.totalValue,
        cumulativeReturnPct: entry.cumulativeReturnPct,
        rank: entry.rank,
        previousRank,
        rankChange: computeRankChange(entry.rank, previousRank),
        weeklyReturnPct,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}
