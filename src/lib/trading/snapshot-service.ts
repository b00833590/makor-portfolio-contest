import "server-only";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { refreshAssetPricesIfStale } from "@/lib/prices/pull-through";
import { computeAvailableCash } from "./execute-order";
import { computeSnapshot, type ComputedSnapshot, type SnapshotPosition } from "./performance-snapshot";
import { rankEntries } from "@/lib/gamification/ranking";

/**
 * Contrairement à get-leaderboard.ts / portfolio-view.ts / get-*-stats.ts, ce chemin ne dépendait
 * jusqu'ici que du dernier prix déjà en base, sans jamais le rafraîchir — le seul endroit du code
 * à ne pas suivre ce pattern. Si l'ingestion planifiée (cron/GitHub Action) échoue en silence
 * pendant un moment (aucun log en place avant ce correctif, voir ingest.ts), le snapshot du jour
 * fige la performance sur un prix périmé au lieu d'échouer bruyamment : totalValue stagne d'un
 * jour à l'autre et dailyReturnPct reste proche de 0% indéfiniment. Rafraîchir ici avant de calculer
 * garantit que le chiffre verrouillé chaque jour reflète un prix frais, peu importe l'état du reste
 * du pipeline d'ingestion.
 */
async function loadSnapshotPositions(portfolioId: string): Promise<SnapshotPosition[]> {
  const positions = await db.position.findMany({
    where: { portfolioId, quantity: { gt: 0 }, closedAt: null },
    include: { asset: { include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
  });

  const distinctAssets = new Map(positions.map((position) => [position.assetId, position.asset]));
  const refreshedPrices = await refreshAssetPricesIfStale([...distinctAssets.values()]);

  return positions.map((position) => ({
    quantity: Number(position.quantity),
    currentPrice:
      refreshedPrices.get(position.assetId)?.price ?? Number(position.asset.prices[0]?.price ?? position.avgEntryPrice),
  }));
}

export async function snapshotPortfolio(
  portfolioId: string,
  initialCapital: number,
  now: Date = new Date(),
): Promise<void> {
  const [availableCash, positions, previousSnapshot] = await Promise.all([
    computeAvailableCash(portfolioId, initialCapital),
    loadSnapshotPositions(portfolioId),
    db.performanceSnapshot.findFirst({
      where: { portfolioId },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  const snapshot = computeSnapshot({
    availableCash,
    positions,
    initialCapital,
    previousSnapshot: previousSnapshot ? { totalValue: Number(previousSnapshot.totalValue) } : null,
  });

  await db.performanceSnapshot.create({
    data: {
      portfolioId,
      timestamp: now,
      totalValue: snapshot.totalValue,
      dailyReturnPct: snapshot.dailyReturnPct,
      cumulativeReturnPct: snapshot.cumulativeReturnPct,
      // Pas de contexte inter-portefeuilles disponible ici (appel isolé, ex. recalcul admin
      // après correction manuelle) — le rang n'est écrit que par le calcul en lot ci-dessous,
      // seul endroit qui connaît le classement du jour au moment même du snapshot.
      rank: null,
    },
  });
}

export interface SnapshotRunResult {
  portfolioId: string;
  status: "ok" | "failed";
}

async function computePortfolioSnapshot(
  portfolioId: string,
  initialCapital: number,
): Promise<ComputedSnapshot> {
  const [availableCash, positions, previousSnapshot] = await Promise.all([
    computeAvailableCash(portfolioId, initialCapital),
    loadSnapshotPositions(portfolioId),
    db.performanceSnapshot.findFirst({
      where: { portfolioId },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  return computeSnapshot({
    availableCash,
    positions,
    initialCapital,
    previousSnapshot: previousSnapshot ? { totalValue: Number(previousSnapshot.totalValue) } : null,
  });
}

/**
 * Snapshotte tous les portefeuilles des promotions actives. Le rang de chaque portefeuille est
 * calculé une fois par promotion, à partir des `totalValue` fraîchement calculés ci-dessous (pas
 * relu depuis un classement live séparé, qui pourrait diverger si des prix bougent entre les
 * deux appels dans le même passage de cron) — voir PerformanceSnapshot.rank dans le schéma.
 * L'isolation des échecs par portefeuille (un portefeuille en erreur n'empêche pas les autres
 * d'être snapshottés) est préservée : l'échec du calcul est capturé avant le classement, qui ne
 * porte donc que sur les portefeuilles effectivement calculés avec succès.
 */
export async function snapshotActivePromotions(now: Date = new Date()): Promise<SnapshotRunResult[]> {
  const activePromotions = await db.promotion.findMany({
    where: { status: PromotionStatus.ACTIVE },
    select: { id: true, initialCapital: true },
  });

  const results: SnapshotRunResult[] = [];

  for (const promotion of activePromotions) {
    const portfolios = await db.portfolio.findMany({
      where: { promotionId: promotion.id },
      select: { id: true },
    });

    const computed: { portfolioId: string; snapshot: ComputedSnapshot }[] = [];
    for (const portfolio of portfolios) {
      try {
        const snapshot = await computePortfolioSnapshot(portfolio.id, Number(promotion.initialCapital));
        computed.push({ portfolioId: portfolio.id, snapshot });
      } catch {
        results.push({ portfolioId: portfolio.id, status: "failed" });
      }
    }

    const ranked = rankEntries(
      computed.map((entry) => ({ portfolioId: entry.portfolioId, cumulativeReturnPct: entry.snapshot.cumulativeReturnPct })),
    );
    const rankByPortfolioId = new Map(ranked.map((entry) => [entry.portfolioId, entry.rank]));

    for (const entry of computed) {
      await db.performanceSnapshot.create({
        data: {
          portfolioId: entry.portfolioId,
          timestamp: now,
          totalValue: entry.snapshot.totalValue,
          dailyReturnPct: entry.snapshot.dailyReturnPct,
          cumulativeReturnPct: entry.snapshot.cumulativeReturnPct,
          rank: rankByPortfolioId.get(entry.portfolioId) ?? null,
        },
      });
      results.push({ portfolioId: entry.portfolioId, status: "ok" });
    }
  }

  return results;
}
