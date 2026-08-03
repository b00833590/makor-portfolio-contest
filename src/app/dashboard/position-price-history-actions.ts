"use server";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getAssetPriceHistory, type PriceHistoryPeriod } from "@/lib/prices/get-asset-price-history";
import type { HistoryPoint } from "@/lib/prices/types";

export interface PositionPriceHistoryResult {
  points: HistoryPoint[];
  isFromProvider: boolean;
}

/** Historique de cours d'un actif pour le panneau graphique de position — accessible à tout participant connecté. */
export async function getPositionPriceHistory(
  assetId: string,
  period: PriceHistoryPeriod,
  openedAt: string,
): Promise<PositionPriceHistoryResult> {
  await verifySession();

  const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
  return getAssetPriceHistory(asset, period, { purchasedAt: new Date(openedAt) });
}
