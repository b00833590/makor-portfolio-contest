import "server-only";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { computeAvailableCash } from "./execute-order";
import { computeSnapshot, type SnapshotPosition } from "./performance-snapshot";

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
    },
  });
}

export interface SnapshotRunResult {
  portfolioId: string;
  status: "ok" | "failed";
}

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

    for (const portfolio of portfolios) {
      try {
        await snapshotPortfolio(portfolio.id, Number(promotion.initialCapital), now);
        results.push({ portfolioId: portfolio.id, status: "ok" });
      } catch {
        results.push({ portfolioId: portfolio.id, status: "failed" });
      }
    }
  }

  return results;
}
