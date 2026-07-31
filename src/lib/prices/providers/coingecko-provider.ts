import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { FetchedPrice, PriceProvider } from "@/lib/prices/types";

/**
 * CoinGecko's public "simple price" endpoint needs no API key. Used for the
 * single crypto allowed by the règlement (docs/CONCEPTION.md section 6).
 * Symbol must be the CoinGecko coin id (e.g. "bitcoin"), not a ticker.
 */
export class CoinGeckoProvider implements PriceProvider {
  readonly source = "coingecko";

  supports(asset: Pick<Asset, "type">): boolean {
    return asset.type === AssetType.CRYPTO;
  }

  async fetchPrice(asset: Pick<Asset, "symbol" | "currency">): Promise<FetchedPrice | null> {
    const coinId = asset.symbol.toLowerCase();
    const vsCurrency = asset.currency.toLowerCase();
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(vsCurrency)}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const body = (await response.json()) as Record<string, Record<string, number>>;
    const price = body[coinId]?.[vsCurrency];
    if (typeof price !== "number") return null;

    return { price, timestamp: new Date(), source: this.source };
  }
}
