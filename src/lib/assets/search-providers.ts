import { AssetType } from "@/generated/prisma/enums";

export interface AssetSearchResult {
  symbol: string;
  name: string;
  type: AssetType;
  currency: string;
  externalId?: string;
  logoUrl: string | null;
  /** Display-only (e.g. "Paris", "Toronto") — never stored, just shown in search so unrelated companies with similar names (see market-parity note below) aren't mistaken for each other. */
  exchangeLabel?: string;
}

export interface YahooSymbolSearchItem {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType: string;
  exchDisp?: string;
}

/**
 * Pure mapping so the merge/dedupe logic is testable without mocking `fetch`.
 *
 * Search and price both come from Yahoo Finance (see yahoo-provider.ts for
 * why) so the symbol a search result returns is guaranteed to be exactly
 * the symbol Yahoo's price endpoint expects — no cross-provider ticker
 * format mismatch is possible (this used to source search from Twelve Data
 * instead, which formats share classes with a dot — "SECT.B" — while
 * Yahoo's own convention uses a dash — "SECT-B" — so a search result could
 * silently fail to ever price). Non-US listings already carry Yahoo's own
 * market suffix (".PA", ".ST"...); US ones never do, which is also how
 * price-provider routing decides between Twelve Data (US, see
 * twelve-data-provider.ts) and Yahoo (everything else).
 *
 * `exchangeLabel` guards against a different, real risk than ticker
 * collisions: two genuinely different, unrelated companies with similar
 * *names* (not tickers) — e.g. searching "Total Energy" returns only
 * "Total Energy Services Inc." (a small Canadian oilfield-services company)
 * on every exchange, never "TotalEnergies SE" (the French energy major,
 * only found by searching its exact one-word name or ticker). Nothing about
 * the symbol format catches that mix-up — only showing the exchange next to
 * the name gives a participant enough context to notice before buying the
 * wrong company outright.
 */
export function mapYahooStockResults(items: YahooSymbolSearchItem[], limit = 6): AssetSearchResult[] {
  const seen = new Set<string>();
  const results: AssetSearchResult[] = [];

  for (const item of items) {
    if (item.quoteType !== "EQUITY") continue;

    const symbol = item.symbol?.trim().toUpperCase();
    const name = (item.longname ?? item.shortname ?? "").replace(/\s+/g, " ").trim();
    if (!symbol || !name || seen.has(symbol)) continue;
    seen.add(symbol);

    results.push({
      symbol,
      name,
      type: AssetType.STOCK,
      currency: "EUR",
      logoUrl: `https://images.financialmodelingprep.com/symbol/${symbol.split(/[.-]/)[0]}.png`,
      exchangeLabel: item.exchDisp,
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
