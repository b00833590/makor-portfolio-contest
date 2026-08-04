import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  mapCoinGeckoResults,
  mapTwelveDataResults,
  type AssetSearchResult,
  type CoinGeckoSearchCoin,
  type TwelveDataSymbolSearchItem,
} from "@/lib/assets/search-providers";

async function searchStocks(query: string): Promise<AssetSearchResult[]> {
  try {
    const url = new URL("https://api.twelvedata.com/symbol_search");
    url.searchParams.set("symbol", query);
    url.searchParams.set("outputsize", "8");

    const apiKey = process.env.TWELVE_DATA_API_KEY;
    const response = await fetch(url, {
      cache: "no-store",
      headers: apiKey ? { Authorization: `apikey ${apiKey}` } : undefined,
    });
    if (!response.ok) return [];

    const body = (await response.json()) as { data?: TwelveDataSymbolSearchItem[] };
    if (!Array.isArray(body.data)) return [];

    return mapTwelveDataResults(body.data);
  } catch {
    return [];
  }
}

async function searchCryptos(query: string): Promise<AssetSearchResult[]> {
  try {
    const url = new URL("https://api.coingecko.com/api/v3/search");
    url.searchParams.set("query", query);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];

    const body = (await response.json()) as { coins?: CoinGeckoSearchCoin[] };
    if (!Array.isArray(body.coins)) return [];

    return mapCoinGeckoResults(body.coins);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 1) {
    return NextResponse.json({ results: [] satisfies AssetSearchResult[] });
  }

  const [stocks, cryptos] = await Promise.all([searchStocks(query), searchCryptos(query)]);

  return NextResponse.json({ results: [...stocks, ...cryptos] satisfies AssetSearchResult[] });
}
