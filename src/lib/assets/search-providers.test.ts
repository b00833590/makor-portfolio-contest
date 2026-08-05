import { describe, it, expect } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import { mapCoinGeckoResults, mapYahooStockResults } from "./search-providers";

describe("mapYahooStockResults", () => {
  it("maps a US equity to type STOCK with no market suffix, using Yahoo's own symbol verbatim", () => {
    const results = mapYahooStockResults([
      { symbol: "AAPL", shortname: "Apple Inc.", quoteType: "EQUITY" },
    ]);

    expect(results).toEqual([
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        type: AssetType.STOCK,
        currency: "EUR",
        logoUrl: "https://images.financialmodelingprep.com/symbol/AAPL.png",
      },
    ]);
  });

  it("keeps Yahoo's own market suffix for a European listing", () => {
    const results = mapYahooStockResults([
      { symbol: "MC.PA", longname: "LVMH Moët Hennessy Louis Vuitton SE", quoteType: "EQUITY" },
    ]);

    expect(results).toEqual([
      {
        symbol: "MC.PA",
        name: "LVMH Moët Hennessy Louis Vuitton SE",
        type: AssetType.STOCK,
        currency: "EUR",
        logoUrl: "https://images.financialmodelingprep.com/symbol/MC.png",
      },
    ]);
  });

  it("keeps Yahoo's dash for a US share class (not a market suffix)", () => {
    const results = mapYahooStockResults([
      { symbol: "BRK-B", shortname: "Berkshire Hathaway Inc. New", quoteType: "EQUITY" },
    ]);

    expect(results[0].symbol).toBe("BRK-B");
    expect(results[0].logoUrl).toBe("https://images.financialmodelingprep.com/symbol/BRK.png");
  });

  it("keeps two unrelated companies that share the same raw ticker on different exchanges as separate results", () => {
    const results = mapYahooStockResults([
      { symbol: "MC.PA", longname: "LVMH Moët Hennessy Louis Vuitton SE", quoteType: "EQUITY" },
      { symbol: "MC", shortname: "Moelis & Company", quoteType: "EQUITY" },
    ]);

    expect(results).toEqual([
      expect.objectContaining({ symbol: "MC.PA", name: "LVMH Moët Hennessy Louis Vuitton SE" }),
      expect.objectContaining({ symbol: "MC", name: "Moelis & Company" }),
    ]);
  });

  it("excludes non-equity quote types (ETFs, indices, currencies...)", () => {
    const results = mapYahooStockResults([
      { symbol: "IWDA.AS", longname: "iShares Core MSCI World UCITS ETF", quoteType: "ETF" },
    ]);

    expect(results).toHaveLength(0);
  });

  it("prefers longname over shortname, and trims/collapses whitespace padding", () => {
    const results = mapYahooStockResults([
      { symbol: "SECT-B.ST", shortname: "Sectra AB                     N", longname: "Sectra AB (publ)", quoteType: "EQUITY" },
    ]);

    expect(results[0].name).toBe("Sectra AB (publ)");
  });

  it("dedupes an identical symbol appearing twice", () => {
    const item = { symbol: "MSFT", shortname: "Microsoft Corporation", quoteType: "EQUITY" };
    const results = mapYahooStockResults([item, item]);

    expect(results).toHaveLength(1);
  });

  it("caps results at the given limit", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      symbol: `SYM${i}`,
      shortname: `Company ${i}`,
      quoteType: "EQUITY",
    }));

    const results = mapYahooStockResults(items, 3);

    expect(results).toHaveLength(3);
  });

  it("skips items with an empty symbol or no usable name", () => {
    const results = mapYahooStockResults([
      { symbol: "", shortname: "Unknown", quoteType: "EQUITY" },
      { symbol: "NONAME", quoteType: "EQUITY" },
    ]);

    expect(results).toHaveLength(0);
  });
});

describe("mapCoinGeckoResults", () => {
  it("maps a coin to type CRYPTO with its coingecko id as externalId", () => {
    const results = mapCoinGeckoResults([
      { id: "bitcoin", name: "Bitcoin", symbol: "btc", thumb: "https://example.com/btc.png", market_cap_rank: 1 },
    ]);

    expect(results).toEqual([
      {
        symbol: "BTC",
        name: "Bitcoin",
        type: AssetType.CRYPTO,
        currency: "EUR",
        externalId: "bitcoin",
        logoUrl: "https://example.com/btc.png",
      },
    ]);
  });

  it("falls back to a null logo when thumb is missing", () => {
    const results = mapCoinGeckoResults([{ id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1 }]);

    expect(results[0].logoUrl).toBeNull();
  });

  it("dedupes repeated symbols, keeping the first", () => {
    const results = mapCoinGeckoResults([
      { id: "bitcoin", name: "Bitcoin", symbol: "BTC", market_cap_rank: 1 },
      { id: "bitcoin-2", name: "Bitcoin Duplicate", symbol: "btc", market_cap_rank: 2 },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].externalId).toBe("bitcoin");
  });

  it("filters out obscure tokenized-stock proxies with no or poor market cap rank", () => {
    const results = mapCoinGeckoResults([
      { id: "apple-xstock", name: "Apple xStock", symbol: "AAPLX", market_cap_rank: 1215 },
      { id: "wrapped-apple-xstock", name: "Wrapped Apple xStock", symbol: "WAAPLX", market_cap_rank: null },
      { id: "ethereum", name: "Ethereum", symbol: "ETH", market_cap_rank: 2 },
    ]);

    expect(results).toEqual([
      { symbol: "ETH", name: "Ethereum", type: AssetType.CRYPTO, currency: "EUR", externalId: "ethereum", logoUrl: null },
    ]);
  });

  it("caps results at the given limit", () => {
    const coins = Array.from({ length: 6 }, (_, i) => ({
      id: `coin-${i}`,
      name: `Coin ${i}`,
      symbol: `C${i}`,
      market_cap_rank: i + 1,
    }));

    const results = mapCoinGeckoResults(coins, 2);

    expect(results).toHaveLength(2);
  });
});
