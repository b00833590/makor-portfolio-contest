import "server-only";
import { db } from "@/lib/db";

export interface PromotionPerformancePoint {
  /** Clé de fusion triable (YYYY-MM-DD), pas affichée telle quelle. */
  date: string;
  /** Libellé affiché sur le graphique. */
  label: string;
  /** Rendement cumulé (%) par nom de participant à cette date, `undefined` si absent ce jour-là. */
  [participantName: string]: string | number | undefined;
}

export interface PromotionPerformanceSeries {
  points: PromotionPerformancePoint[];
  participantNames: string[];
}

/** Évolution du rendement cumulé de tous les participants, pour le graphique comparatif du classement. */
export async function getPromotionPerformanceSeries(promotionId: string): Promise<PromotionPerformanceSeries> {
  const portfolios = await db.portfolio.findMany({
    where: { promotionId },
    include: {
      user: { select: { name: true } },
      snapshots: { orderBy: { timestamp: "asc" } },
    },
  });

  const pointsByDate = new Map<string, PromotionPerformancePoint>();

  for (const portfolio of portfolios) {
    for (const snapshot of portfolio.snapshots) {
      const dateKey = snapshot.timestamp.toISOString().slice(0, 10);
      const point = pointsByDate.get(dateKey) ?? {
        date: dateKey,
        label: snapshot.timestamp.toLocaleDateString("fr-FR"),
      };
      point[portfolio.user.name] = Number(snapshot.cumulativeReturnPct);
      pointsByDate.set(dateKey, point);
    }
  }

  const points = Array.from(pointsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    points,
    participantNames: portfolios.map((portfolio) => portfolio.user.name),
  };
}
