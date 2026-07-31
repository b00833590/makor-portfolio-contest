import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, PriceProvider } from "@/lib/prices/types";

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
}
