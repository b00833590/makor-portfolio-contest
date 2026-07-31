import "server-only";
import { db } from "@/lib/db";

export interface PerformancePoint {
  date: string;
  totalValue: number;
  cumulativeReturnPct: number;
}

export async function getPerformanceHistory(portfolioId: string): Promise<PerformancePoint[]> {
  const snapshots = await db.performanceSnapshot.findMany({
    where: { portfolioId },
    orderBy: { timestamp: "asc" },
  });

  return snapshots.map((snapshot) => ({
    date: snapshot.timestamp.toLocaleDateString("fr-FR"),
    totalValue: Number(snapshot.totalValue),
    cumulativeReturnPct: Number(snapshot.cumulativeReturnPct),
  }));
}
