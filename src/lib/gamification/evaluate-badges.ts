import "server-only";
import { db } from "@/lib/db";
import { badgeDefinitions } from "./badge-definitions";
import { evaluateBadgeCriteria, type BadgeEvaluationContext } from "./badge-criteria";
import { getLeaderboard } from "./get-leaderboard";

async function ensureBadgesSeeded(): Promise<Map<string, string>> {
  const badgeIdByCode = new Map<string, string>();
  for (const definition of badgeDefinitions) {
    const badge = await db.badge.upsert({
      where: { code: definition.code },
      update: { name: definition.name, description: definition.description, icon: definition.icon },
      create: definition,
    });
    badgeIdByCode.set(definition.code, badge.id);
  }
  return badgeIdByCode;
}

async function buildEvaluationContext(
  portfolioId: string,
  leaderboardRow: { rank: number; previousRank: number | null; cumulativeReturnPct: number },
  now: Date,
): Promise<BadgeEvaluationContext> {
  const [positions, lastTransaction] = await Promise.all([
    db.position.findMany({
      where: { portfolioId, quantity: { gt: 0 }, closedAt: null },
      include: { asset: { include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
    }),
    db.transaction.findFirst({ where: { portfolioId }, orderBy: { createdAt: "desc" } }),
  ]);

  const positionContexts = positions.map((position) => {
    const quantity = Number(position.quantity);
    const avgEntryPrice = Number(position.avgEntryPrice);
    const currentPrice = Number(position.asset.prices[0]?.price ?? avgEntryPrice);
    return { marketValue: quantity * currentPrice, costBasis: quantity * avgEntryPrice };
  });

  return {
    now,
    investedValue: positionContexts.reduce((total, position) => total + position.marketValue, 0),
    positions: positionContexts,
    lastTransactionDate: lastTransaction?.createdAt ?? null,
    cumulativeReturnPct: leaderboardRow.cumulativeReturnPct,
    currentRank: leaderboardRow.rank,
    previousRank: leaderboardRow.previousRank,
  };
}

export interface BadgeAwardResult {
  userId: string;
  awarded: string[];
}

export async function evaluateAndAwardBadges(
  promotionId: string,
  now: Date = new Date(),
): Promise<BadgeAwardResult[]> {
  const [badgeIdByCode, leaderboard] = await Promise.all([
    ensureBadgesSeeded(),
    getLeaderboard(promotionId, now),
  ]);

  const results: BadgeAwardResult[] = [];

  for (const row of leaderboard) {
    const context = await buildEvaluationContext(row.portfolioId, row, now);
    const earnedCodes = evaluateBadgeCriteria(context);

    for (const code of earnedCodes) {
      const badgeId = badgeIdByCode.get(code);
      if (!badgeId) continue;
      await db.userBadge.upsert({
        where: { userId_badgeId_promotionId: { userId: row.userId, badgeId, promotionId } },
        update: {},
        create: { userId: row.userId, badgeId, promotionId },
      });
    }

    results.push({ userId: row.userId, awarded: earnedCodes });
  }

  return results;
}
