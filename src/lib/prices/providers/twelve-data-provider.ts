import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, HistoryPoint, HistoryRequest, PriceProvider } from "@/lib/prices/types";

/** interval Twelve Data le plus fin capable de couvrir `days` en <= 5000 points (limite de l'API gratuite). */
function resolveInterval(request: HistoryRequest): { interval: string; outputsize: number } {
  if (request.interval === "auto") {
    if (request.days <= 1) return { interval: "5min", outputsize: 200 };
    if (request.days <= 7) return { interval: "1h", outputsize: 200 };
    return { interval: "1day", outputsize: Math.min(Math.ceil(request.days) + 2, 5000) };
  }
  if (request.interval === "5min") return { interval: "5min", outputsize: 200 };
  if (request.interval === "1h") return { interval: "1h", outputsize: 200 };
  return { interval: "1day", outputsize: Math.min(Math.ceil(request.days) + 2, 5000) };
}

/**
 * Twelve Data real-time price endpoint, for stocks.
 * https://twelvedata.com/docs#price — 1 API credit per symbol per call.
 */
export class TwelveDataProvider implements PriceProvider {
  readonly source = "twelve-data";

  constructor(private readonly apiKey: string) {}

  supports(asset: Pick<Asset, "type">): boolean {
    return asset.type === AssetType.STOCK;
  }

  async fetchPrice(asset: Pick<Asset, "symbol" | "currency">): Promise<FetchedPrice | null> {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(asset.symbol)}`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `apikey ${this.apiKey}` },
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { price?: string; code?: number; message?: string };
    if (!body.price) return null;

    const price = Number(body.price);
    if (!Number.isFinite(price)) return null;

    return { price, timestamp: new Date(), source: this.source };
  }

  /** https://twelvedata.com/docs#time-series */
  async fetchHistory(asset: Pick<Asset, "symbol">, request: HistoryRequest): Promise<HistoryPoint[] | null> {
    const { interval, outputsize } = resolveInterval(request);
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(asset.symbol)}&interval=${interval}&outputsize=${outputsize}`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `apikey ${this.apiKey}` },
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      values?: { datetime: string; close: string; volume?: string }[];
      code?: number;
    };
    if (!body.values) return null;

    return body.values
      .map((row) => ({
        timestamp: new Date(row.datetime.length <= 10 ? `${row.datetime}T00:00:00Z` : `${row.datetime}Z`),
        price: Number(row.close),
        volume: row.volume ? Number(row.volume) : undefined,
      }))
      .filter((point) => Number.isFinite(point.price))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}
