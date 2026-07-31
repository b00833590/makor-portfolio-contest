import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, PriceProvider } from "@/lib/prices/types";

/**
 * Twelve Data real-time price endpoint, for actions and ETF.
 * https://twelvedata.com/docs#price — 1 API credit per symbol per call.
 */
export class TwelveDataProvider implements PriceProvider {
  readonly source = "twelve-data";

  constructor(private readonly apiKey: string) {}

  supports(asset: Pick<Asset, "type">): boolean {
    return asset.type === AssetType.STOCK || asset.type === AssetType.ETF;
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
}
