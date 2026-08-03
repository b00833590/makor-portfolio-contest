import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, HistoryPoint, HistoryRequest, PriceProvider } from "@/lib/prices/types";

function hashToUnitInterval(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (hash % 10_000) / 10_000;
}

/**
 * Deterministic fallback used when no real market data provider is configured
 * (local dev, tests). Never used automatically once a real API key is set —
 * see src/lib/prices/index.ts.
 */
export class MockPriceProvider implements PriceProvider {
  readonly source = "mock";

  supports(): boolean {
    return true;
  }

  async fetchPrice(asset: Pick<Asset, "symbol" | "currency">): Promise<FetchedPrice> {
    const basePrice = 10 + hashToUnitInterval(asset.symbol) * 990;
    const jitterPct = (hashToUnitInterval(asset.symbol + Date.now().toString().slice(0, -4)) - 0.5) * 0.02;
    const price = Number((basePrice * (1 + jitterPct)).toFixed(4));

    return { price, timestamp: new Date(), source: this.source };
  }

  /** Historique synthétique mais déterministe (même marche aléatoire que fetchPrice) — utile en dev sans clé API. */
  async fetchHistory(asset: Pick<Asset, "symbol">, request: HistoryRequest): Promise<HistoryPoint[]> {
    const basePrice = 10 + hashToUnitInterval(asset.symbol) * 990;
    const pointCount = 60;
    const stepMs = (request.days * 24 * 60 * 60 * 1000) / pointCount;
    const now = Date.now();

    return Array.from({ length: pointCount + 1 }, (_, index) => {
      const timestamp = new Date(now - (pointCount - index) * stepMs);
      const jitterPct = (hashToUnitInterval(`${asset.symbol}-${index}`) - 0.5) * 0.03;
      const drift = 1 + (index / pointCount) * (hashToUnitInterval(asset.symbol + "drift") - 0.5) * 0.1;
      return { timestamp, price: Number((basePrice * drift * (1 + jitterPct)).toFixed(4)) };
    });
  }
}
