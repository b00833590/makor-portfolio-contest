import type { Asset } from "@/generated/prisma/client";

export interface FetchedPrice {
  price: number;
  timestamp: Date;
  source: string;
}

export interface HistoryPoint {
  timestamp: Date;
  price: number;
  volume?: number;
}

/** Granularité demandée au fournisseur — "auto" laisse le fournisseur choisir la plus adaptée à `days`. */
export type HistoryInterval = "5min" | "1h" | "1day" | "auto";

export interface HistoryRequest {
  /** Fenêtre couverte, en jours (peut être fractionnaire pour < 1 jour). */
  days: number;
  interval: HistoryInterval;
}

/**
 * A price provider knows how to fetch the latest quote for one asset type.
 * Swap or add providers in src/lib/prices/index.ts without touching the
 * ingestion job (src/app/api/cron/ingest-prices).
 */
export interface PriceProvider {
  readonly source: string;
  supports(asset: Pick<Asset, "type">): boolean;
  fetchPrice(asset: Pick<Asset, "symbol" | "currency" | "externalId">): Promise<FetchedPrice | null>;
  /** Historique de cours (optionnel — absent tant qu'un fournisseur ne l'implémente pas). */
  fetchHistory?(
    asset: Pick<Asset, "symbol" | "currency" | "externalId">,
    request: HistoryRequest,
  ): Promise<HistoryPoint[] | null>;
}
