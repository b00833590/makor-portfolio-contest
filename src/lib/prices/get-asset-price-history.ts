import "server-only";
import { db } from "@/lib/db";
import { getPriceProviders } from "@/lib/prices";
import { fetchHistoryWithFallback } from "@/lib/prices/provider-fallback";
import type { Asset } from "@/generated/prisma/client";
import type { HistoryInterval, HistoryPoint } from "@/lib/prices/types";

export type PriceHistoryPeriod = "1D" | "1W" | "1M" | "SINCE_PURCHASE";

const PERIOD_SETTINGS: Record<Exclude<PriceHistoryPeriod, "SINCE_PURCHASE">, { days: number; interval: HistoryInterval }> = {
  "1D": { days: 1, interval: "5min" },
  "1W": { days: 7, interval: "1h" },
  "1M": { days: 30, interval: "1day" },
};

/** Nombre de jours max couverts par "depuis l'achat", pour ne pas exploser le volume de requêtes fournisseur. */
const MAX_SINCE_PURCHASE_DAYS = 730;

function resolveDaysAndInterval(
  period: PriceHistoryPeriod,
  purchasedAt: Date | undefined,
  now: Date,
): { days: number; interval: HistoryInterval } {
  if (period !== "SINCE_PURCHASE") return PERIOD_SETTINGS[period];

  const elapsedDays = purchasedAt ? (now.getTime() - purchasedAt.getTime()) / (24 * 60 * 60 * 1000) : 30;
  return { days: Math.min(Math.max(elapsedDays, 1), MAX_SINCE_PURCHASE_DAYS), interval: "auto" };
}

type AssetForHistory = Pick<Asset, "id" | "symbol" | "type" | "currency" | "externalId">;

export interface AssetPriceHistoryResult {
  points: HistoryPoint[];
  /** `false` quand la série vient du repli sur la table Price interne (échantillonnage épars) plutôt que du fournisseur. */
  isFromProvider: boolean;
}

/**
 * Historique de cours pour un actif sur une période donnée, en tentant d'abord
 * le fournisseur externe (granularité fine) puis, à défaut, la table `Price`
 * interne accumulée par le rafraîchissement "pull-through" (voir pull-through.ts) —
 * plus éparse, mais toujours disponible sans clé API.
 */
export async function getAssetPriceHistory(
  asset: AssetForHistory,
  period: PriceHistoryPeriod,
  options: { purchasedAt?: Date; now?: Date } = {},
): Promise<AssetPriceHistoryResult> {
  const now = options.now ?? new Date();
  const { days, interval } = resolveDaysAndInterval(period, options.purchasedAt, now);

  const providerPoints = await fetchHistoryWithFallback(getPriceProviders(), asset, { days, interval });
  if (providerPoints && providerPoints.length > 0) {
    return { points: providerPoints, isFromProvider: true };
  }

  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rows = await db.price.findMany({
    where: { assetId: asset.id, timestamp: { gte: since, lte: now } },
    orderBy: { timestamp: "asc" },
  });

  return {
    points: rows.map((row) => ({ timestamp: row.timestamp, price: Number(row.price) })),
    isFromProvider: false,
  };
}
