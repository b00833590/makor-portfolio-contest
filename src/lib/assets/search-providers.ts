import { AssetType } from "@/generated/prisma/enums";

export interface AssetSearchResult {
  symbol: string;
  name: string;
  type: AssetType;
  currency: string;
  externalId?: string;
  logoUrl: string | null;
}

export interface TwelveDataSymbolSearchItem {
  symbol: string;
  instrument_name: string;
  instrument_type: string;
  currency: string;
}

/** "Common Stock" is the only genuine tradable listing on this platform; other types (Depositary Receipt, etc.) are secondary fallbacks. */
function isPrimaryListing(item: TwelveDataSymbolSearchItem): boolean {
  return item.instrument_type === "Common Stock";
}

/**
 * Pure mapping so the merge/dedupe logic is testable without mocking `fetch`.
 *
 * Twelve Data returns every exchange listing for a ticker, in no reliable
 * relevance order (e.g. "MSFT" can list an Argentine depositary receipt
 * before the NASDAQ common stock) — dedupe by symbol, but let a later
 * primary listing (Common Stock) replace an earlier secondary one.
 * Symbols containing "/" (e.g. "ETH/USD") are forex/pair listings, not
 * equities, so they're excluded outright. ETF listings are excluded
 * outright too — only individual stocks and crypto (via CoinGecko) are
 * investable on this platform.
 */
export function mapTwelveDataResults(items: TwelveDataSymbolSearchItem[], limit = 6): AssetSearchResult[] {
  const bySymbol = new Map<string, TwelveDataSymbolSearchItem>();
  const order: string[] = [];

  for (const item of items) {
    const symbol = item.symbol?.trim().toUpperCase();
    if (!symbol || symbol.includes("/") || item.instrument_type === "ETF") continue;

    const existing = bySymbol.get(symbol);
    if (!existing) {
      bySymbol.set(symbol, item);
      order.push(symbol);
    } else if (isPrimaryListing(item) && !isPrimaryListing(existing)) {
      bySymbol.set(symbol, item);
    }
  }

  return order.slice(0, limit).map((symbol) => {
    const item = bySymbol.get(symbol)!;
    return {
      symbol,
      name: item.instrument_name,
      type: AssetType.STOCK,
      currency: item.currency,
      logoUrl: `https://images.financialmodelingprep.com/symbol/${symbol}.png`,
    };
  });
}

export interface CoinGeckoSearchCoin {
  id: string;
  name: string;
  symbol: string;
  thumb?: string;
  market_cap_rank: number | null;
}

/**
 * CoinGecko's search also surfaces "tokenized stock" proxies that happen to
 * share a ticker with a real company (e.g. searching "AAPL" returns "Apple
 * xStock", "Apple (Ondo Tokenized Stock)"...) — these are obscure synthetic
 * tokens, never genuine top-of-market coins, and always rank past a few
 * hundred. Capping to the top ranks filters that noise out without a
 * fragile name/keyword blocklist.
 */
const MAX_MARKET_CAP_RANK = 250;

/** vs_currencies=eur keeps crypto quotes in the platform's accounting currency. */
export function mapCoinGeckoResults(coins: CoinGeckoSearchCoin[], limit = 4): AssetSearchResult[] {
  const seen = new Set<string>();
  const results: AssetSearchResult[] = [];

  for (const coin of coins) {
    if (coin.market_cap_rank == null || coin.market_cap_rank > MAX_MARKET_CAP_RANK) continue;

    const symbol = coin.symbol?.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);

    results.push({
      symbol,
      name: coin.name,
      type: AssetType.CRYPTO,
      currency: "EUR",
      externalId: coin.id,
      logoUrl: coin.thumb || null,
    });

    if (results.length >= limit) break;
  }

  return results;
}
