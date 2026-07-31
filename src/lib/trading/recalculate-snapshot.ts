import "server-only";
import { db } from "@/lib/db";
import { recomputePortfolioPositions } from "./recompute-portfolio";
import { snapshotPortfolio } from "./snapshot-service";

/**
 * Recalcule un portefeuille "à chaud" après une correction admin : reconstruit
 * les positions à partir des transactions, puis enregistre un nouvel
 * instantané de performance daté d'aujourd'hui. Ne réécrit pas l'historique
 * des jours passés (qui resterait basé sur l'état d'alors) — seul le point du
 * jour, et tous les suivants, reflètent la correction.
 */
export async function recalculatePortfolioSnapshot(portfolioId: string, now: Date = new Date()): Promise<void> {
  const portfolio = await db.portfolio.findUniqueOrThrow({
    where: { id: portfolioId },
    include: { promotion: { select: { initialCapital: true } } },
  });

  await recomputePortfolioPositions(portfolioId);
  await snapshotPortfolio(portfolioId, Number(portfolio.promotion.initialCapital), now);
}

/** Même chose pour tous les portefeuilles d'une promotion — utile après une correction touchant plusieurs participants. */
export async function recalculateAllPortfolioSnapshots(promotionId: string, now: Date = new Date()): Promise<void> {
  const portfolios = await db.portfolio.findMany({ where: { promotionId }, select: { id: true } });
  for (const portfolio of portfolios) {
    await recalculatePortfolioSnapshot(portfolio.id, now);
  }
}
