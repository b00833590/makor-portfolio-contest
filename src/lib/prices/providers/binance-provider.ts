import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, HistoryPoint, HistoryRequest, PriceProvider } from "@/lib/prices/types";

type BinanceKline = [number, string, string, string, string, string, number, ...unknown[]];

/** Klines Binance les plus fines capables de couvrir `days` en <= 1000 points (max de l'API publique). */
function resolveInterval(request: HistoryRequest): { interval: string; limit: number } {
  if (request.interval === "auto") {
    if (request.days <= 1) return { interval: "5m", limit: 288 };
    if (request.days <= 7) return { interval: "1h", limit: 168 };
    return { interval: "1d", limit: Math.min(Math.ceil(request.days) + 2, 1000) };
  }
  if (request.interval === "5min") return { interval: "5m", limit: 288 };
  if (request.interval === "1h") return { interval: "1h", limit: 168 };
  return { interval: "1d", limit: Math.min(Math.ceil(request.days) + 2, 1000) };
}

/**
 * Binance, marché public — aucune clé requise, aucun quota significatif pour
 * notre usage. Remplace CoinGecko comme fournisseur de PRIX pour la crypto
 * (CoinGecko reste utilisé pour la RECHERCHE de tickers dans
 * src/lib/assets/search-providers.ts, qui a besoin du nom/logo/rang par
 * capitalisation que Binance ne fournit pas). C'est ce qui permet un
 * rafraîchissement quasi temps réel de la seule crypto active à la fois
 * autorisée par le règlement (docs/CONCEPTION.md section 6) — voir
 * src/lib/prices/staleness.ts pour le seuil de péremption appliqué.
 *
 * https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
 */
export class BinanceProvider implements PriceProvider {
  readonly source = "binance";

  supports(asset: Pick<Asset, "type">): boolean {
    return asset.type === AssetType.CRYPTO;
  }

  private pairSymbol(asset: Pick<Asset, "symbol" | "currency">): string {
    return `${asset.symbol}${asset.currency}`.toUpperCase();
  }

  async fetchPrice(asset: Pick<Asset, "symbol" | "currency" | "externalId">): Promise<FetchedPrice | null> {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(this.pairSymbol(asset))}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const body = (await response.json()) as { price?: string };
    if (!body.price) return null;

    const price = Number(body.price);
    if (!Number.isFinite(price)) return null;

    return { price, timestamp: new Date(), source: this.source };
  }

  async fetchHistory(
    asset: Pick<Asset, "symbol" | "currency" | "externalId">,
    request: HistoryRequest,
  ): Promise<HistoryPoint[] | null> {
    const { interval, limit } = resolveInterval(request);
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(this.pairSymbol(asset))}&interval=${interval}&limit=${limit}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!Array.isArray(body)) return null;

    return (body as BinanceKline[])
      .map(([, , , , close, , closeTime]) => ({ timestamp: new Date(closeTime), price: Number(close) }))
      .filter((point) => Number.isFinite(point.price))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}
