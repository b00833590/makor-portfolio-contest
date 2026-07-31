import type { Asset } from "@/generated/prisma/client";

export interface FetchedPrice {
  price: number;
  timestamp: Date;
  source: string;
}

/**
 * A price provider knows how to fetch the latest quote for one asset type.
 * Swap or add providers in src/lib/prices/index.ts without touching the
 * ingestion job (src/app/api/cron/ingest-prices).
 */
export interface PriceProvider {
  readonly source: string;
  supports(asset: Pick<Asset, "type">): boolean;
  fetchPrice(asset: Pick<Asset, "symbol" | "currency">): Promise<FetchedPrice | null>;
}
