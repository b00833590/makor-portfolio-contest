export interface BuyForGainScan {
  assetId: string;
  price: number;
  createdAt: Date;
}

export interface PriceHistoryPoint {
  price: number;
  timestamp: Date;
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Meilleur gain % atteint dans les 5 jours suivant un achat, tous achats confondus — `null` si
 * aucun achat n'a de données de prix postérieures disponibles.
 */
export function computeMaxPostBuyGainPct(
  buys: BuyForGainScan[],
  priceHistoryByAsset: Map<string, PriceHistoryPoint[]>,
): number | null {
  let best: number | null = null;

  for (const buy of buys) {
    if (buy.price <= 0) continue;
    const windowEnd = buy.createdAt.getTime() + FIVE_DAYS_MS;
    const pricesAfter = (priceHistoryByAsset.get(buy.assetId) ?? []).filter(
      (point) => point.timestamp.getTime() >= buy.createdAt.getTime() && point.timestamp.getTime() <= windowEnd,
    );
    for (const point of pricesAfter) {
      const gainPct = ((point.price - buy.price) / buy.price) * 100;
      if (best === null || gainPct > best) best = gainPct;
    }
  }

  return best;
}
