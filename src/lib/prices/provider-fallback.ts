import "server-only";
import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, HistoryPoint, HistoryRequest, PriceProvider } from "./types";

type AssetForFetch = Pick<Asset, "type" | "symbol" | "currency" | "externalId">;

/**
 * Tries each provider that supports the asset, in declared order, until one
 * returns a real result — a provider returning null (rate-limited, symbol
 * not found, transient failure...) isn't treated as final, the next one
 * gets a chance. Centralized here so ingest.ts, pull-through.ts, and
 * get-asset-price-history.ts share one fallback policy instead of each
 * re-implementing "pick the first supporting provider" (and stopping there)
 * on its own — that's what silently stalled US stock prices for the rest of
 * a trading day once Twelve Data's daily quota ran out, with no fallback to
 * the Yahoo provider that was working fine the whole time.
 */
export async function fetchPriceWithFallback(providers: PriceProvider[], asset: AssetForFetch): Promise<FetchedPrice | null> {
  for (const provider of providers) {
    if (!provider.supports(asset)) continue;
    const quote = await provider.fetchPrice(asset);
    if (quote) return quote;
  }
  return null;
}

export async function fetchHistoryWithFallback(
  providers: PriceProvider[],
  asset: AssetForFetch,
  request: HistoryRequest,
): Promise<HistoryPoint[] | null> {
  for (const provider of providers) {
    if (!provider.supports(asset) || !provider.fetchHistory) continue;
    const points = await provider.fetchHistory(asset, request);
    if (points && points.length > 0) return points;
  }
  return null;
}
