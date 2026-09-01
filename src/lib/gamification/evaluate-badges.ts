import "server-only";
import { db } from "@/lib/db";
import { TransactionType, ChangeSessionKind, ChangeSessionStatus } from "@/generated/prisma/enums";
import type { BadgeRarity } from "@/generated/prisma/enums";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { BADGE_CATALOG, CLOSE_ONLY_CODES, evaluateBadgeCatalog } from "./badges/catalog";
import type { BadgeEvaluationContext, ChangeWindowUsage, RankHistoryPoint } from "./badges/types";
import { computeHasSuccessfulArbitrage } from "./badges/trading";
import { computeMaxPostBuyGainPct } from "./badges/post-buy-gain";
import { getLeaderboard, type LeaderboardRow } from "./get-leaderboard";
import { buildTrades } from "./match-closing-trades";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export interface AwardedBadge {
  code: string;
  name: string;
  rarity: BadgeRarity;
  icon: string;
  description: string;
}

export async function ensureBadgesSeeded(): Promise<void> {
  for (const spec of BADGE_CATALOG) {
    const data = {
      name: spec.name,
      description: spec.description,
      condition: spec.condition,
      category: spec.category,
      rarity: spec.rarity,
      icon: spec.icon,
    };
    await db.badge.upsert({
      where: { code: spec.code },
      update: data,
      create: { code: spec.code, ...data },
    });
  }
}

async function buildEvaluationContext(
  userId: string,
  portfolioId: string,
  promotionId: string,
  maxPositions: number,
  row: LeaderboardRow,
  leaderboard: LeaderboardRow[],
  now: Date,
): Promise<BadgeEvaluationContext> {
  const [allPositions, transactions, snapshots, closedWeeklySessions, user, existingBadges] = await Promise.all([
    db.position.findMany({
      where: { portfolioId },
      include: { asset: { select: { type: true, prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
    }),
    db.transaction.findMany({
      where: { portfolioId },
      select: { assetId: true, type: true, price: true, quantity: true, changeSessionId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.performanceSnapshot.findMany({ where: { portfolioId }, orderBy: { timestamp: "desc" } }),
    db.changeSession.findMany({
      where: { promotionId, kind: ChangeSessionKind.WEEKLY, status: ChangeSessionStatus.CLOSED },
      include: { usages: { where: { userId } } },
    }),
    db.user.findUnique({ where: { id: userId }, select: { currentStreakDays: true, longestStreakDays: true } }),
    db.userBadge.findMany({ where: { userId, promotionId }, include: { badge: { select: { code: true } } } }),
  ]);

  const openPositions = allPositions.filter((position) => Number(position.quantity) > 0 && position.closedAt === null);
  // Clé sur les positions OUVERTES uniquement : le prix d'entrée d'une position clôturée sur le même
  // actif ne doit jamais servir de fallback pour valoriser la position ouverte.
  const currentPriceByAsset = new Map(
    openPositions.map((position) => [position.assetId, Number(position.asset.prices[0]?.price ?? position.avgEntryPrice)]),
  );

  const positionSnapshots = openPositions.map((position) => {
    const quantity = Number(position.quantity);
    const avgEntryPrice = Number(position.avgEntryPrice);
    const currentPrice = currentPriceByAsset.get(position.assetId) ?? avgEntryPrice;
    return { marketValue: quantity * currentPrice, costBasis: quantity * avgEntryPrice };
  });

  const trades = buildTrades(
    allPositions.map((position) => ({
      id: position.id,
      assetId: position.assetId,
      avgEntryPrice: Number(position.avgEntryPrice),
      quantity: Number(position.quantity),
      openedAt: position.openedAt,
      closedAt: position.closedAt,
    })),
    transactions.map((transaction) => ({
      assetId: transaction.assetId,
      type: transaction.type,
      price: Number(transaction.price),
      quantity: Number(transaction.quantity),
      createdAt: transaction.createdAt,
    })),
    currentPriceByAsset,
  );
  const closedAtByPositionId = new Map(
    allPositions.filter((position) => position.closedAt).map((position) => [position.id, position.closedAt!]),
  );
  const closedTradesChronological = trades
    .filter((trade) => !trade.isOpen)
    .map((trade) => ({
      pnlEur: trade.pnlEur,
      pnlPct: trade.pnlPct,
      closedAt: closedAtByPositionId.get(trade.positionId)!,
    }))
    .filter((trade) => trade.closedAt)
    .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());

  const currentPnlPctByAsset = new Map(
    openPositions.map((position) => {
      const avgEntryPrice = Number(position.avgEntryPrice);
      const currentPrice = currentPriceByAsset.get(position.assetId) ?? avgEntryPrice;
      const pnlPct = avgEntryPrice > 0 ? ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100 : 0;
      return [position.assetId, pnlPct];
    }),
  );
  const hasSuccessfulArbitrage = computeHasSuccessfulArbitrage(transactions, currentPnlPctByAsset);

  const buyTransactions = transactions.filter((t) => t.type === TransactionType.BUY);
  const priceHistoryByAsset = new Map<string, { price: number; timestamp: Date }[]>();
  if (buyTransactions.length > 0) {
    const buyAssetIds = [...new Set(buyTransactions.map((t) => t.assetId))];
    const minDate = new Date(Math.min(...buyTransactions.map((t) => t.createdAt.getTime())));
    const maxDate = new Date(Math.max(...buyTransactions.map((t) => t.createdAt.getTime())) + FIVE_DAYS_MS);
    const priceRows = await db.price.findMany({
      where: { assetId: { in: buyAssetIds }, timestamp: { gte: minDate, lte: maxDate } },
      orderBy: { timestamp: "asc" },
    });
    for (const priceRow of priceRows) {
      const list = priceHistoryByAsset.get(priceRow.assetId) ?? [];
      list.push({ price: Number(priceRow.price), timestamp: priceRow.timestamp });
      priceHistoryByAsset.set(priceRow.assetId, list);
    }
  }
  const postBuyMaxGainPct = computeMaxPostBuyGainPct(
    buyTransactions.map((t) => ({ assetId: t.assetId, price: Number(t.price), createdAt: t.createdAt })),
    priceHistoryByAsset,
  );

  const rankHistory: RankHistoryPoint[] = snapshots.map((snapshot) => ({ timestamp: snapshot.timestamp, rank: snapshot.rank }));
  const dailyReturnPct = snapshots.length > 0 ? Number(snapshots[0].dailyReturnPct) : null;

  const rank2 = leaderboard.find((r) => r.rank === 2);
  const gapToSecondPts = row.rank === 1 && rank2 ? row.cumulativeReturnPct - rank2.cumulativeReturnPct : null;

  const weeklyChangeWindows: ChangeWindowUsage[] = closedWeeklySessions.map((session) => ({
    hadWindow: session.maxChangesPerParticipant > 0,
    changesUsed: session.usages[0]?.changesUsed ?? 0,
  }));

  const fieldAverageReturnPct =
    leaderboard.length > 0
      ? leaderboard.reduce((sum, entry) => sum + entry.cumulativeReturnPct, 0) / leaderboard.length
      : 0;

  const weeklyValues = leaderboard
    .map((entry) => entry.weeklyReturnPct)
    .filter((value): value is number => value !== null);
  const bestWeekly = weeklyValues.length > 0 ? Math.max(...weeklyValues) : null;
  const hasBestWeeklyReturn =
    weeklyValues.length >= 3 &&
    row.weeklyReturnPct !== null &&
    row.weeklyReturnPct > 0 &&
    bestWeekly !== null &&
    row.weeklyReturnPct >= bestWeekly;

  const distinctAssetsTradedCount = new Set(transactions.map((transaction) => transaction.assetId)).size;

  const openAssetTypes = new Set(openPositions.map((position) => position.asset.type));
  const holdsStockAndCrypto = openAssetTypes.has("STOCK") && openAssetTypes.has("CRYPTO");

  const totalMarketValue = positionSnapshots.reduce((total, position) => total + position.marketValue, 0);
  const maxPositionConcentrationPct =
    positionSnapshots.length > 0 && totalMarketValue > 0
      ? (Math.max(...positionSnapshots.map((position) => position.marketValue)) / totalMarketValue) * 100
      : null;

  const ANCHOR_MIN_AGE_MS = 21 * 24 * 60 * 60 * 1000;
  const ANCHOR_MIN_GAIN_PCT = 10;
  const touchedAssetIds = new Set(
    transactions
      .filter(
        (transaction) =>
          transaction.type === TransactionType.INCREASE ||
          transaction.type === TransactionType.SELL_PARTIAL ||
          transaction.type === TransactionType.DECREASE,
      )
      .map((transaction) => transaction.assetId),
  );
  const hasAnchorPosition = openPositions.some((position) => {
    if (now.getTime() - position.openedAt.getTime() < ANCHOR_MIN_AGE_MS) return false;
    if (touchedAssetIds.has(position.assetId)) return false;
    const avgEntryPrice = Number(position.avgEntryPrice);
    const currentPrice = currentPriceByAsset.get(position.assetId) ?? avgEntryPrice;
    const pnlPct = avgEntryPrice > 0 ? ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100 : 0;
    return pnlPct >= ANCHOR_MIN_GAIN_PCT;
  });

  const historyRanks = rankHistory.map((point) => point.rank); // le plus récent en premier
  const lostLeadIndex = historyRanks.findIndex((rank) => rank !== null && rank > 1);
  const regainedFirstPlace =
    row.rank === 1 && lostLeadIndex !== -1 && historyRanks.slice(lostLeadIndex + 1).some((rank) => rank === 1);

  return {
    now,
    openPositionCount: openPositions.length,
    maxPositions,
    investedValue: positionSnapshots.reduce((total, position) => total + position.marketValue, 0),
    positions: positionSnapshots,
    transactionCount: transactions.length,
    firstTransactionDate: transactions[0]?.createdAt ?? null,
    lastTransactionDate: transactions[transactions.length - 1]?.createdAt ?? null,
    closedTradesChronological,
    hasSuccessfulArbitrage,
    postBuyMaxGainPct,
    cumulativeReturnPct: row.cumulativeReturnPct,
    dailyReturnPct,
    currentRank: row.rank,
    previousRank: row.previousRank,
    gapToSecondPts,
    rankHistory,
    participantCount: leaderboard.length,
    fieldAverageReturnPct,
    hasBestWeeklyReturn,
    distinctAssetsTradedCount,
    holdsStockAndCrypto,
    maxPositionConcentrationPct,
    hasAnchorPosition,
    regainedFirstPlace,
    weeklyChangeWindows,
    currentStreakDays: user?.currentStreakDays ?? 0,
    longestStreakDays: user?.longestStreakDays ?? 0,
    alreadyOwnedCodes: new Set(existingBadges.map((userBadge) => userBadge.badge.code)),
    totalBadgeCount: BADGE_CATALOG.length,
    evaluatableBadgeCount: BADGE_CATALOG.length - CLOSE_ONLY_CODES.size,
  };
}

async function awardBadgesForContext(
  userId: string,
  promotionId: string,
  context: BadgeEvaluationContext,
): Promise<AwardedBadge[]> {
  const earnedCodes = evaluateBadgeCatalog(context);
  const newCodes = earnedCodes.filter((code) => !context.alreadyOwnedCodes.has(code));
  if (newCodes.length === 0) return [];

  // LEVE_TOT est exclusif (un seul gagnant par promotion) — l'état DB au moment de
  // l'attribution est la seule source fiable, pas dérivable du contexte pur d'un utilisateur.
  const filteredCodes: string[] = [];
  for (const code of newCodes) {
    if (code === "LEVE_TOT") {
      const alreadyAwarded = await db.userBadge.count({ where: { promotionId, badge: { code: "LEVE_TOT" } } });
      if (alreadyAwarded > 0) continue;
    }
    filteredCodes.push(code);
  }
  if (filteredCodes.length === 0) return [];

  const badgeRows = await db.badge.findMany({ where: { code: { in: filteredCodes } } });
  const awarded: AwardedBadge[] = [];
  for (const badge of badgeRows) {
    await db.userBadge.upsert({
      where: { userId_badgeId_promotionId: { userId, badgeId: badge.id, promotionId } },
      update: {},
      create: { userId, badgeId: badge.id, promotionId },
    });
    awarded.push({ code: badge.code, name: badge.name, rarity: badge.rarity, icon: badge.icon, description: badge.description });
  }
  return awarded;
}

export async function markBadgesSeen(userId: string, promotionId: string, codes: string[]): Promise<void> {
  if (codes.length === 0) return;
  await db.userBadge.updateMany({
    where: { userId, promotionId, seenAt: null, badge: { code: { in: codes } } },
    data: { seenAt: new Date() },
  });
}

export async function evaluateUserBadges(
  userId: string,
  promotionId: string,
  now: Date = new Date(),
): Promise<AwardedBadge[]> {
  await ensureBadgesSeeded();
  const [leaderboard, promotion] = await Promise.all([
    getLeaderboard(promotionId, now),
    db.promotion.findUniqueOrThrow({ where: { id: promotionId } }),
  ]);
  const row = leaderboard.find((r) => r.userId === userId);
  if (!row) return [];

  const maxPositions = promotionRulesSchema.parse(promotion.rules).maxPositions;
  const context = await buildEvaluationContext(userId, row.portfolioId, promotionId, maxPositions, row, leaderboard, now);
  return awardBadgesForContext(userId, promotionId, context);
}

/** Résout la promotion active de l'utilisateur puis délègue — point d'entrée pour le
 * déclenchement instantané après une action de trading. Marque les badges obtenus comme vus
 * dans la même requête (contrairement au cron nocturne) puisqu'un toast est affiché immédiatement. */
export async function evaluateUserBadgesForUser(userId: string, now: Date = new Date()): Promise<AwardedBadge[]> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { promotionId: true } });
  if (!user?.promotionId) return [];

  const awarded = await evaluateUserBadges(userId, user.promotionId, now);
  await markBadgesSeen(userId, user.promotionId, awarded.map((badge) => badge.code));
  return awarded;
}

export interface BadgeAwardResult {
  userId: string;
  awarded: string[];
}

export async function evaluateAndAwardBadges(
  promotionId: string,
  now: Date = new Date(),
): Promise<BadgeAwardResult[]> {
  await ensureBadgesSeeded();
  const [leaderboard, promotion] = await Promise.all([
    getLeaderboard(promotionId, now),
    db.promotion.findUniqueOrThrow({ where: { id: promotionId } }),
  ]);
  const maxPositions = promotionRulesSchema.parse(promotion.rules).maxPositions;

  const results: BadgeAwardResult[] = [];
  for (const row of leaderboard) {
    const context = await buildEvaluationContext(
      row.userId,
      row.portfolioId,
      promotionId,
      maxPositions,
      row,
      leaderboard,
      now,
    );
    const awarded = await awardBadgesForContext(row.userId, promotionId, context);
    results.push({ userId: row.userId, awarded: awarded.map((badge) => badge.code) });
  }
  return results;
}
