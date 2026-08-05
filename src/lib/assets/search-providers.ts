import { AssetType } from "@/generated/prisma/enums";
import { marketSuffixFor } from "./market-suffix";

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
  mic_code: string;
  country: string;
}

/**
 * Pure mapping so the merge/dedupe logic is testable without mocking `fetch`.
 *
 * Twelve Data returns every exchange listing for a ticker — only "Common
 * Stock" listings are genuine tradable shares on this platform (Depositary
 * Receipts, forex pairs, and ETFs are excluded outright). The same raw
 * ticker can belong to two unrelated companies on different exchanges (e.g.
 * "MC" is both LVMH on Euronext Paris and Moelis & Company on the NYSE), so
 * non-US listings get a market suffix (see market-suffix.ts) to stay
 * unambiguous — that also means results are deduped per (symbol, market)
 * instead of per raw symbol, so distinct companies never collide.
 */
export function mapTwelveDataResults(items: TwelveDataSymbolSearchItem[], limit = 6): AssetSearchResult[] {
  const seen = new Set<string>();
  const results: AssetSearchResult[] = [];

  for (const item of items) {
    const rawSymbol = item.symbol?.trim().toUpperCase();
    if (!rawSymbol || rawSymbol.includes("/") || item.instrument_type !== "Common Stock") continue;

    const isUnitedStates = item.country === "United States";
    const micCode = isUnitedStates ? undefined : item.mic_code;
    const displaySymbol = `${rawSymbol}${marketSuffixFor(micCode)}`;

    if (seen.has(displaySymbol)) continue;
    seen.add(displaySymbol);

    results.push({
      symbol: displaySymbol,
      name: item.instrument_name,
      type: AssetType.STOCK,
      currency: item.currency,
      externalId: micCode,
      logoUrl: `https://images.financialmodelingprep.com/symbol/${rawSymbol}.png`,
    });

    if (results.length >= limit) break;
  }

  return results;
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
