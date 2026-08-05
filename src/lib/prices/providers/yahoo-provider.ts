import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, HistoryPoint, HistoryRequest, PriceProvider } from "@/lib/prices/types";

/** Yahoo returns 429 to requests with no User-Agent at all — any browser-like value works. */
const USER_AGENT = "Mozilla/5.0";

/** Smallest Yahoo `range` bucket that covers the requested window (Yahoo takes discrete buckets, not an arbitrary day count). */
function pickRange(days: number): string {
  if (days <= 1) return "1d";
  if (days <= 5) return "5d";
  if (days <= 30) return "1mo";
  if (days <= 90) return "3mo";
  if (days <= 180) return "6mo";
  if (days <= 365) return "1y";
  if (days <= 730) return "2y";
  if (days <= 1825) return "5y";
  return "10y";
}

function resolveRangeAndInterval(request: HistoryRequest): { range: string; interval: string } {
  if (request.interval === "auto") {
    if (request.days <= 1) return { range: "1d", interval: "5m" };
    if (request.days <= 7) return { range: "5d", interval: "60m" };
    return { range: pickRange(request.days), interval: "1d" };
  }
  if (request.interval === "5min") return { range: "1d", interval: "5m" };
  if (request.interval === "1h") return { range: "5d", interval: "60m" };
  return { range: pickRange(request.days), interval: "1d" };
}

interface YahooChartResponse {
  chart: {
    result:
      | [
          {
            meta: { regularMarketPrice?: number; regularMarketTime?: number };
            timestamp?: number[];
            indicators: { quote: [{ close?: (number | null)[]; volume?: (number | null)[] }] };
          },
        ]
      | null;
    error: { code: string; description: string } | null;
  };
}

/**
 * Twelve Data's free plan only covers US exchanges (see market-suffix.ts and
 * the "externalId as mic_code" convention in search-providers.ts) — Yahoo
 * Finance's undocumented chart endpoint is used as a free, keyless
 * complement specifically for non-US listings, so European (and any other
 * international) stocks stay purchasable without a paid data plan. This is
 * the same endpoint the widely-used `yfinance` Python library relies on:
 * unofficial and unsupported by Yahoo, so it may change or get rate-limited
 * without notice — if that happens, only non-US stocks are affected
 * (getPriceProviders keeps Twelve Data as the sole US provider).
 */
export class YahooProvider implements PriceProvider {
  readonly source = "yahoo";

  /** Only claims non-US stocks (externalId = mic_code, stamped by search-providers.ts) — Twelve Data keeps US stocks. */
  supports(asset: Pick<Asset, "type" | "externalId">): boolean {
    return asset.type === AssetType.STOCK && Boolean(asset.externalId);
  }

  private async fetchChart(symbol: string, params?: Record<string, string>): Promise<YahooChartResponse["chart"]["result"] extends infer R ? R : never> {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) {
      console.error(`[ingest:yahoo] ${symbol}: HTTP ${response.status} — ${await response.text()}`);
      return null;
    }

    const body = (await response.json()) as YahooChartResponse;
    if (body.chart.error || !body.chart.result) {
      console.error(`[ingest:yahoo] ${symbol}: ${body.chart.error?.code} — ${body.chart.error?.description}`);
      return null;
    }

    return body.chart.result;
  }

  async fetchPrice(asset: Pick<Asset, "symbol">): Promise<FetchedPrice | null> {
    const result = await this.fetchChart(asset.symbol);
    if (!result) return null;

    const { regularMarketPrice, regularMarketTime } = result[0].meta;
    if (regularMarketPrice === undefined || !Number.isFinite(regularMarketPrice)) return null;

    return {
      price: regularMarketPrice,
      timestamp: regularMarketTime ? new Date(regularMarketTime * 1000) : new Date(),
      source: this.source,
    };
  }

  async fetchHistory(asset: Pick<Asset, "symbol">, request: HistoryRequest): Promise<HistoryPoint[] | null> {
    const { range, interval } = resolveRangeAndInterval(request);
    const result = await this.fetchChart(asset.symbol, { range, interval });
    if (!result) return null;

    const timestamps = result[0].timestamp ?? [];
    const closes = result[0].indicators.quote[0]?.close ?? [];
    const volumes = result[0].indicators.quote[0]?.volume ?? [];

    const points: HistoryPoint[] = [];
    for (const [index, ts] of timestamps.entries()) {
      const price = closes[index];
      if (!Number.isFinite(price)) continue;
      points.push({ timestamp: new Date(ts * 1000), price: price as number, volume: volumes[index] ?? undefined });
    }

    return points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}
