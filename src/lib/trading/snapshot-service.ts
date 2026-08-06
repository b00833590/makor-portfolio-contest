import "server-only";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { computeAvailableCash } from "./execute-order";
import { computeSnapshot, type ComputedSnapshot, type SnapshotPosition } from "./performance-snapshot";
import { rankEntries } from "@/lib/gamification/ranking";

async function loadSnapshotPositions(portfolioId: string): Promise<SnapshotPosition[]> {
  const positions = await db.position.findMany({
    where: { portfolioId, quantity: { gt: 0 }, closedAt: null },
    include: { asset: { include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
  });

  return positions.map((position) => ({
    quantity: Number(position.quantity),
    currentPrice: Number(position.asset.prices[0]?.price ?? position.avgEntryPrice),
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
