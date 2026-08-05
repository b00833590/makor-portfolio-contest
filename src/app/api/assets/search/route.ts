import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  mapCoinGeckoResults,
  mapYahooStockResults,
  type AssetSearchResult,
  type CoinGeckoSearchCoin,
  type YahooSymbolSearchItem,
} from "@/lib/assets/search-providers";

/** Same undocumented endpoint as yahoo-provider.ts (fetchPrice/fetchHistory) — see there for why. */
async function searchStocks(query: string): Promise<AssetSearchResult[]> {
  try {
    const url = new URL("https://query2.finance.yahoo.com/v1/finance/search");
    url.searchParams.set("q", query);

    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!response.ok) return [];

    const body = (await response.json()) as { quotes?: YahooSymbolSearchItem[] };
    if (!Array.isArray(body.quotes)) return [];

    return mapYahooStockResults(body.quotes);
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
