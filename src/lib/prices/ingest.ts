import "server-only";
import { db } from "@/lib/db";
import type { PriceProvider } from "@/lib/prices/types";

export interface IngestResult {
  assetId: string;
  symbol: string;
  status: "ok" | "unsupported" | "failed";
  price?: number;
}

export async function ingestAssetPrices(providers: PriceProvider[]): Promise<IngestResult[]> {
  const assets = await db.asset.findMany({ where: { isActive: true } });
  const results: IngestResult[] = [];

  for (const asset of assets) {
    const provider = providers.find((candidate) => candidate.supports(asset));
    if (!provider) {
      results.push({ assetId: asset.id, symbol: asset.symbol, status: "unsupported" });
      continue;
    }

    try {
      const quote = await provider.fetchPrice(asset);
      if (!quote) {
        results.push({ assetId: asset.id, symbol: asset.symbol, status: "failed" });
        continue;
      }

      await db.price.create({
        data: {
          assetId: asset.id,
          timestamp: quote.timestamp,
          price: quote.price,
          source: quote.source,
        },
      });

      results.push({ assetId: asset.id, symbol: asset.symbol, status: "ok", price: quote.price });
    } catch {
      results.push({ assetId: asset.id, symbol: asset.symbol, status: "failed" });
    }
  }

  return results;
}
