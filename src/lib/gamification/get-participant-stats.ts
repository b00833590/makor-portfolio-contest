import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { refreshAssetPricesIfStale } from "@/lib/prices/pull-through";
import { buildTrades } from "./match-closing-trades";
import type { BestWorstPosition, LeaderboardRow } from "./get-leaderboard";

export interface AllocationSlice {
  key: string;
  valuePct: number;
}

export interface ParticipantStats {
  bestPosition: BestWorstPosition | null;
  worstPosition: BestWorstPosition | null;
  unrealizedGainEur: number;
  cumulativeReturnPct: number;
  weeklyReturnPct: number | null;
  dailyReturnPct: number | null;
  transactionCount: number;
  winRatePct: number | null;
  avgPositionPerformancePct: number | null;
  avgGainPerWinningTradeEur: number | null;
  avgLossPerLosingTradeEur: number | null;
  /** Écart-type (échantillon) des rendements journaliers, en points de %. */
  volatilityPct: number | null;
  sectorAllocation: AllocationSlice[];
  assetClassAllocation: AllocationSlice[];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values)!;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function buildAllocation<K extends string>(
  entries: { key: K; value: number }[],
): AllocationSlice[] {
  const totalValue = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (totalValue <= 0) return [];

  const byKey = new Map<K, number>();
  for (const entry of entries) byKey.set(entry.key, (byKey.get(entry.key) ?? 0) + entry.value);

  return [...byKey.entries()]
    .map(([key, value]) => ({ key, valuePct: (value / totalValue) * 100 }))
    .sort((a, b) => b.valuePct - a.valuePct);
}

/**
 * Statistiques enrichies d'un participant, au-delà de ce que fournit déjà le
 * classement (`getLeaderboard`) — passé en paramètre pour éviter de refaire
 * le calcul live de valeur/rang déjà fait une fois par page.
 */
export async function getParticipantStats(
  portfolioId: string,
  leaderboardRow: Pick<LeaderboardRow, "cumulativeReturnPct" | "weeklyReturnPct" | "bestPosition" | "worstPosition">,
): Promise<ParticipantStats> {
  const [positions, transactions, snapshots, transactionCount] = await Promise.all([
    db.position.findMany({
      where: { portfolioId },
      include: { asset: { include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
    }),
    db.transaction.findMany({ where: { portfolioId }, select: { assetId: true, type: true, price: true, quantity: true, createdAt: true } }),
    db.performanceSnapshot.findMany({ where: { portfolioId }, orderBy: { timestamp: "asc" } }),
    db.transaction.count({ where: { portfolioId } }),
  ]);

  const openPositions = positions.filter((position) => Number(position.quantity) > 0 && position.closedAt === null);
  const refreshedPrices = await refreshAssetPricesIfStale(openPositions.map((position) => position.asset));
  const currentPricesByAsset = new Map(
    openPositions.map((position) => [
      position.assetId,
      refreshedPrices.get(position.assetId)?.price ?? Number(position.asset.prices[0]?.price ?? position.avgEntryPrice),
    ]),
  );

  const trades = buildTrades(
    positions.map((position) => ({
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
    currentPricesByAsset,
  );

  const winners = trades.filter((trade) => trade.pnlEur >= 0);
  const losers = trades.filter((trade) => trade.pnlEur < 0);

  const dailyReturns = snapshots.map((snapshot) => Number(snapshot.dailyReturnPct));
  const unrealizedGainEur = trades
    .filter((trade) => trade.isOpen)
    .reduce((sum, trade) => sum + trade.pnlEur, 0);

  const sectorEntries = openPositions.map((position) => ({
    key: position.asset.sector ?? "Non renseigné",
    value: (currentPricesByAsset.get(position.assetId) ?? 0) * Number(position.quantity),
  }));
  const assetClassEntries = openPositions.map((position) => ({
    key: position.asset.type,
    value: (currentPricesByAsset.get(position.assetId) ?? 0) * Number(position.quantity),
  }));

  return {
    bestPosition: leaderboardRow.bestPosition,
    worstPosition: leaderboardRow.worstPosition,
    unrealizedGainEur,
    cumulativeReturnPct: leaderboardRow.cumulativeReturnPct,
    weeklyReturnPct: leaderboardRow.weeklyReturnPct,
    dailyReturnPct: snapshots.length > 0 ? Number(snapshots[snapshots.length - 1].dailyReturnPct) : null,
    transactionCount,
    winRatePct: trades.length > 0 ? (winners.length / trades.length) * 100 : null,
    avgPositionPerformancePct: average(trades.map((trade) => trade.pnlPct)),
    avgGainPerWinningTradeEur: average(winners.map((trade) => trade.pnlEur)),
    avgLossPerLosingTradeEur: average(losers.map((trade) => trade.pnlEur)),
    volatilityPct: sampleStdDev(dailyReturns),
    sectorAllocation: buildAllocation(sectorEntries),
    assetClassAllocation: buildAllocation(assetClassEntries),
  };
}

/** Variante mise en cache — voir {@link getCachedLeaderboard} pour le raisonnement. */
export const getCachedParticipantStats = unstable_cache(
  (
    portfolioId: string,
    leaderboardRow: Pick<LeaderboardRow, "cumulativeReturnPct" | "weeklyReturnPct" | "bestPosition" | "worstPosition">,
  ) => getParticipantStats(portfolioId, leaderboardRow),
  ["participant-stats"],
  { revalidate: 600 },
);
