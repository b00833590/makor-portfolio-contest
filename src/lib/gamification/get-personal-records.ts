import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { buildTrades } from "./match-closing-trades";

export interface PersonalRecords {
  bestDayPct: number | null;
  bestDayDate: Date | null;
  bestTradePct: number | null;
  bestTradeAssetSymbol: string | null;
  longestHoldDays: number | null;
  longestHoldAssetSymbol: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Records personnels — meilleure journée, meilleur trade, plus longue détention. Dérivé des
 * mêmes primitives que get-participant-stats.ts (buildTrades) ; fichier séparé pour ne pas
 * mélanger avec les stats déjà consommées par /statistiques. */
export async function getPersonalRecords(portfolioId: string): Promise<PersonalRecords> {
  const [bestDaySnapshot, positions, transactions] = await Promise.all([
    db.performanceSnapshot.findFirst({ where: { portfolioId }, orderBy: { dailyReturnPct: "desc" } }),
    db.position.findMany({
      where: { portfolioId },
      include: { asset: { select: { symbol: true, prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
    }),
    db.transaction.findMany({
      where: { portfolioId },
      select: { assetId: true, type: true, price: true, quantity: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const currentPriceByAsset = new Map(
    positions.map((position) => [position.assetId, Number(position.asset.prices[0]?.price ?? position.avgEntryPrice)]),
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
    transactions.map((t) => ({
      assetId: t.assetId,
      type: t.type,
      price: Number(t.price),
      quantity: Number(t.quantity),
      createdAt: t.createdAt,
    })),
    currentPriceByAsset,
  );

  const symbolByAssetId = new Map(positions.map((position) => [position.assetId, position.asset.symbol]));
  const bestTrade = trades.reduce<(typeof trades)[number] | null>(
    (best, trade) => (!best || trade.pnlPct > best.pnlPct ? trade : best),
    null,
  );

  const now = new Date();
  const longestHold = positions.reduce<{ symbol: string; days: number } | null>((best, position) => {
    const days = ((position.closedAt ?? now).getTime() - position.openedAt.getTime()) / DAY_MS;
    if (!best || days > best.days) return { symbol: position.asset.symbol, days };
    return best;
  }, null);

  return {
    bestDayPct: bestDaySnapshot ? Number(bestDaySnapshot.dailyReturnPct) : null,
    bestDayDate: bestDaySnapshot?.timestamp ?? null,
    bestTradePct: bestTrade?.pnlPct ?? null,
    bestTradeAssetSymbol: bestTrade ? (symbolByAssetId.get(bestTrade.assetId) ?? null) : null,
    longestHoldDays: longestHold ? Math.round(longestHold.days) : null,
    longestHoldAssetSymbol: longestHold?.symbol ?? null,
  };
}

/** Variante mise en cache — voir {@link getCachedLeaderboard} pour le raisonnement. */
export const getCachedPersonalRecords = unstable_cache(
  (portfolioId: string) => getPersonalRecords(portfolioId),
  ["personal-records"],
  { revalidate: 600 },
);
