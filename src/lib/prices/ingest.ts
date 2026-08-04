import "server-only";
import { db } from "@/lib/db";
import { isPriceStale } from "@/lib/prices/staleness";
import type { PriceProvider } from "@/lib/prices/types";

export interface IngestResult {
  assetId: string;
  symbol: string;
  status: "ok" | "skipped" | "unsupported" | "failed";
  price?: number;
}

/**
 * Ingestion planifiée (cron) : ne rappelle le fournisseur que pour les actifs
 * dont le prix est périmé (même seuil que le rafraîchissement pull-through,
 * voir staleness.ts) — sert de filet de sécurité pour les actifs que
 * personne ne consulte, sans jamais dupliquer un appel déjà couvert par une
 * consultation récente. C'est ce qui permet de planifier ce job bien plus
 * souvent qu'une fois par jour sans dépasser le quota gratuit des
 * fournisseurs (voir .github/workflows/ingest-prices.yml).
 */
export async function ingestAssetPrices(providers: PriceProvider[], now: Date = new Date()): Promise<IngestResult[]> {
  const assets = await db.asset.findMany({ where: { isActive: true } });
  if (assets.length === 0) return [];

  const latestRows = await db.price.findMany({
    where: { assetId: { in: assets.map((asset) => asset.id) } },
    orderBy: { timestamp: "desc" },
    distinct: ["assetId"],
  });
  const latestByAsset = new Map(latestRows.map((row) => [row.assetId, row]));

  const results: IngestResult[] = [];

  for (const asset of assets) {
    const latest = latestByAsset.get(asset.id);
    if (!isPriceStale(latest?.timestamp, asset.type, now)) {
      results.push({ assetId: asset.id, symbol: asset.symbol, status: "skipped", price: latest ? Number(latest.price) : undefined });
      continue;
    }

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
