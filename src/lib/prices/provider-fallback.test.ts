import { describe, it, expect, vi } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { PriceProvider } from "./types";
import { fetchPriceWithFallback, fetchHistoryWithFallback } from "./provider-fallback";

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    symbol: "AAPL",
    name: "Apple Inc.",
    type: AssetType.STOCK,
    sector: null,
    currency: "USD",
    isActive: true,
    createdAt: new Date(),
    externalId: null,
    logoUrl: null,
    ...overrides,
  };
}

function makeProvider(overrides: Partial<PriceProvider> = {}): PriceProvider {
  return {
    source: "test",
    supports: () => true,
    fetchPrice: async () => ({ price: 100, timestamp: new Date(), source: "test" }),
    ...overrides,
  };
}

describe("fetchPriceWithFallback", () => {
  it("returns the first supporting provider's quote", async () => {
    const asset = makeAsset();
    const first = makeProvider({ source: "first", fetchPrice: async () => ({ price: 1, timestamp: new Date(), source: "first" }) });
    const second = makeProvider({ source: "second" });

    const result = await fetchPriceWithFallback([first, second], asset);

    expect(result?.source).toBe("first");
  });

  it("falls back to the next supporting provider when the first returns null", async () => {
    const asset = makeAsset();
    const first = makeProvider({ source: "first", fetchPrice: async () => null });
    const second = makeProvider({ source: "second", fetchPrice: async () => ({ price: 2, timestamp: new Date(), source: "second" }) });

    const result = await fetchPriceWithFallback([first, second], asset);

    expect(result?.source).toBe("second");
    expect(result?.price).toBe(2);
  });

  it("skips providers that don't support the asset", async () => {
    const asset = makeAsset({ type: AssetType.CRYPTO });
    const stockOnly = makeProvider({ source: "stock-only", supports: (a) => a.type === AssetType.STOCK, fetchPrice: async () => ({ price: 1, timestamp: new Date(), source: "stock-only" }) });
    const cryptoProvider = makeProvider({ source: "crypto", supports: (a) => a.type === AssetType.CRYPTO, fetchPrice: async () => ({ price: 2, timestamp: new Date(), source: "crypto" }) });

    const result = await fetchPriceWithFallback([stockOnly, cryptoProvider], asset);

    expect(result?.source).toBe("crypto");
  });

  it("returns null when every supporting provider fails", async () => {
    const asset = makeAsset();
    const first = makeProvider({ fetchPrice: async () => null });
    const second = makeProvider({ fetchPrice: async () => null });

    const result = await fetchPriceWithFallback([first, second], asset);

    expect(result).toBeNull();
  });

  it("does not call a later provider once an earlier one succeeds", async () => {
    const asset = makeAsset();
    const secondFetch = vi.fn(async () => ({ price: 2, timestamp: new Date(), source: "second" }));
    const first = makeProvider({ fetchPrice: async () => ({ price: 1, timestamp: new Date(), source: "first" }) });
    const second = makeProvider({ fetchPrice: secondFetch });

    await fetchPriceWithFallback([first, second], asset);

    expect(secondFetch).not.toHaveBeenCalled();
  });
});

describe("fetchHistoryWithFallback", () => {
  it("falls back when the first provider returns an empty or null series", async () => {
    const asset = makeAsset();
    const first = makeProvider({ fetchHistory: async () => null });
    const second = makeProvider({ fetchHistory: async () => [{ timestamp: new Date(), price: 42 }] });
    const request = { days: 1, interval: "auto" as const };

    const result = await fetchHistoryWithFallback([first, second], asset, request);

    expect(result).toEqual([{ timestamp: expect.any(Date), price: 42 }]);
  });

  it("skips providers without a fetchHistory implementation", async () => {
    const asset = makeAsset();
    const noHistory = makeProvider({ fetchHistory: undefined });
    const withHistory = makeProvider({ fetchHistory: async () => [{ timestamp: new Date(), price: 7 }] });
    const request = { days: 1, interval: "auto" as const };

    const result = await fetchHistoryWithFallback([noHistory, withHistory], asset, request);

    expect(result?.[0].price).toBe(7);
  });
});
