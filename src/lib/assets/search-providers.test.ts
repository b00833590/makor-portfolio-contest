import { describe, it, expect } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import { mapCoinGeckoResults, mapTwelveDataResults } from "./search-providers";

describe("mapTwelveDataResults", () => {
  it("maps a US common stock listing to type STOCK with no market suffix", () => {
    const results = mapTwelveDataResults([
      {
        symbol: "aapl",
        instrument_name: "Apple Inc.",
        instrument_type: "Common Stock",
        currency: "USD",
        mic_code: "XNAS",
        country: "United States",
      },
    ]);

    expect(results).toEqual([
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        type: AssetType.STOCK,
        currency: "USD",
        externalId: undefined,
        logoUrl: "https://images.financialmodelingprep.com/symbol/AAPL.png",
      },
    ]);
  });

  it("maps a European common stock listing with a market suffix and its mic_code as externalId", () => {
    const results = mapTwelveDataResults([
      {
        symbol: "mc",
        instrument_name: "LVMH Moët Hennessy Louis Vuitton SE",
        instrument_type: "Common Stock",
        currency: "EUR",
        mic_code: "XPAR",
        country: "France",
      },
    ]);

    expect(results).toEqual([
      {
        symbol: "MC.PA",
        name: "LVMH Moët Hennessy Louis Vuitton SE",
        type: AssetType.STOCK,
        currency: "EUR",
        externalId: "XPAR",
        logoUrl: "https://images.financialmodelingprep.com/symbol/MC.png",
      },
    ]);
  });

  it("keeps two unrelated companies that share the same raw ticker on different exchanges as separate results", () => {
    const results = mapTwelveDataResults([
      {
        symbol: "MC",
        instrument_name: "LVMH Moët Hennessy Louis Vuitton SE",
        instrument_type: "Common Stock",
        currency: "EUR",
        mic_code: "XPAR",
        country: "France",
      },
      {
        symbol: "MC",
        instrument_name: "Moelis & Company",
        instrument_type: "Common Stock",
        currency: "USD",
        mic_code: "XNYS",
        country: "United States",
      },
    ]);

    expect(results).toEqual([
      expect.objectContaining({ symbol: "MC.PA", name: "LVMH Moët Hennessy Louis Vuitton SE" }),
      expect.objectContaining({ symbol: "MC", name: "Moelis & Company" }),
    ]);
  });

  it("excludes ETF listings entirely", () => {
    const results = mapTwelveDataResults([
      {
        symbol: "IWDA",
        instrument_name: "iShares Core MSCI World UCITS ETF",
        instrument_type: "ETF",
        currency: "EUR",
        mic_code: "XLON",
        country: "United Kingdom",
      },
    ]);

    expect(results).toHaveLength(0);
  });

  it("excludes non-common-stock listings (depositary receipts, etc.)", () => {
    const results = mapTwelveDataResults([
      {
        symbol: "MSFT",
        instrument_name: "Microsoft Corp. CEDEAR",
        instrument_type: "Depositary Receipt",
        currency: "ARS",
        mic_code: "XBUE",
        country: "Argentina",
      },
    ]);

    expect(results).toHaveLength(0);
  });

  it("dedupes an identical (symbol, exchange) pair appearing twice", () => {
    const item = {
      symbol: "MSFT",
      instrument_name: "Microsoft Corporation",
      instrument_type: "Common Stock",
      currency: "USD",
      mic_code: "XNAS",
      country: "United States",
    };
    const results = mapTwelveDataResults([item, item]);

    expect(results).toHaveLength(1);
  });

  it("excludes forex/pair-style symbols containing a slash", () => {
    const results = mapTwelveDataResults([
      {
        symbol: "ETH/USD",
        instrument_name: "Ethereum US Dollar",
        instrument_type: "Common Stock",
        currency: "USD",
        mic_code: "XNAS",
        country: "United States",
      },
    ]);

    expect(results).toHaveLength(0);
  });

  it("caps results at the given limit", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      symbol: `SYM${i}`,
      instrument_name: `Company ${i}`,
      instrument_type: "Common Stock",
      currency: "USD",
      mic_code: "XNAS",
      country: "United States",
    }));

    const results = mapTwelveDataResults(items, 3);

    expect(results).toHaveLength(3);
  });

  it("skips items with an empty symbol", () => {
    const results = mapTwelveDataResults([
      {
        symbol: "",
        instrument_name: "Unknown",
        instrument_type: "Common Stock",
        currency: "USD",
        mic_code: "XNAS",
        country: "United States",
      },
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
