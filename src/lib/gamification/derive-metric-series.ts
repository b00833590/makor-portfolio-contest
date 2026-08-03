import type { PromotionPerformancePoint } from "./get-promotion-performance-series";

export type PerformanceMetric = "totalValue" | "cumulativeReturnPct" | "gainEur" | "dailyReturnPct" | "rank";

export const PERFORMANCE_METRIC_LABELS: Record<PerformanceMetric, string> = {
  totalValue: "Valeur du portefeuille",
  cumulativeReturnPct: "Performance cumulée (%)",
  gainEur: "Performance cumulée (€)",
  dailyReturnPct: "Rendement journalier (%)",
  rank: "Classement",
};

export interface MetricSeriesPoint {
  date: string;
  label: string;
  [participantName: string]: string | number | undefined;
}

/**
 * Projette les points bruts (une métrique par participant) sur UNE métrique
 * choisie, au format attendu par Recharts (une clé par participant). Le
 * classement est calculé ici plutôt que stocké : il dépend de l'ensemble des
 * participants présents à chaque date, pas d'un seul portefeuille isolé.
 */
export function deriveMetricSeries(
  points: PromotionPerformancePoint[],
  metric: PerformanceMetric,
  initialCapital: number,
): MetricSeriesPoint[] {
  return points.map((point) => {
    const row: MetricSeriesPoint = { date: point.date, label: point.label };

    if (metric === "rank") {
      const ranked = Object.entries(point.values).sort(
        (a, b) => b[1].cumulativeReturnPct - a[1].cumulativeReturnPct,
      );
      ranked.forEach(([name], index) => {
        row[name] = index + 1;
      });
      return row;
    }

    for (const [name, metrics] of Object.entries(point.values)) {
      row[name] = metric === "gainEur" ? metrics.totalValue - initialCapital : metrics[metric];
    }
    return row;
  });
}
