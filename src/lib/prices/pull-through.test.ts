import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { PriceProvider } from "@/lib/prices/types";

const priceFindManyMock = vi.fn();
const priceCreateMock = vi.fn();
const getPriceProvidersMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    price: { findMany: priceFindManyMock, create: priceCreateMock },
  },
}));

vi.mock("@/lib/prices", () => ({
  getPriceProviders: getPriceProvidersMock,
}));

const { refreshAssetPricesIfStale, refreshAssetPriceIfStale, PRICE_STALE_MS } = await import("./pull-through");

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
    source: "test-provider",
    supports: () => true,
    fetchPrice: async () => ({ price: 100, timestamp: new Date(), source: "test-provider" }),
    ...overrides,
  };
}

beforeEach(() => {
  priceFindManyMock.mockReset();
  priceCreateMock.mockReset();
  getPriceProvidersMock.mockReset();
});

describe("refreshAssetPricesIfStale", () => {
  it("returns an empty map without querying anything when given no assets", async () => {
    const result = await refreshAssetPricesIfStale([]);

    expect(result.size).toBe(0);
    expect(priceFindManyMock).not.toHaveBeenCalled();
  });

  it("returns the existing price without calling a provider when it is fresh", async () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const timestamp = new Date(now.getTime() - 1000);
    priceFindManyMock.mockResolvedValue([{ assetId: "asset-1", price: 150, timestamp }]);

    const result = await refreshAssetPricesIfStale([makeAsset()], now);

    expect(getPriceProvidersMock).not.toHaveBeenCalled();
    expect(result.get("asset-1")).toEqual({ price: 150, timestamp, isStale: false });
  });

  it("fetches and stores a fresh quote when the latest price is stale", async () => {
    const now = new Date("2026-01-01T12:00:00Z");
    priceFindManyMock.mockResolvedValue([
      { assetId: "asset-1", price: 100, timestamp: new Date(now.getTime() - PRICE_STALE_MS - 1000) },
    ]);
    const quote = { price: 180, timestamp: now, source: "test-provider" };
    getPriceProvidersMock.mockReturnValue([makeProvider({ fetchPrice: async () => quote })]);

    const result = await refreshAssetPricesIfStale([makeAsset()], now);

    expect(priceCreateMock).toHaveBeenCalledWith({
      data: { assetId: "asset-1", timestamp: quote.timestamp, price: quote.price, source: quote.source },
    });
    expect(result.get("asset-1")).toEqual({ price: 180, timestamp: now, isStale: false });
  });

  it("refreshes multiple assets in parallel with a single batched price lookup", async () => {
    priceFindManyMock.mockResolvedValue([]);
    getPriceProvidersMock.mockReturnValue([
      makeProvider({ fetchPrice: async (asset) => ({ price: asset.symbol === "AAPL" ? 180 : 250, timestamp: new Date(), source: "test" }) }),
    ]);

    const result = await refreshAssetPricesIfStale([
      makeAsset({ id: "asset-1", symbol: "AAPL" }),
      makeAsset({ id: "asset-2", symbol: "MSFT" }),
    ]);

    expect(priceFindManyMock).toHaveBeenCalledTimes(1);
    expect(result.get("asset-1")?.price).toBe(180);
    expect(result.get("asset-2")?.price).toBe(250);
  });

  it("falls back to the stale price marked isStale when no provider supports the asset", async () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const timestamp = new Date(now.getTime() - PRICE_STALE_MS - 1000);
    priceFindManyMock.mockResolvedValue([{ assetId: "asset-1", price: 100, timestamp }]);
    getPriceProvidersMock.mockReturnValue([makeProvider({ supports: () => false })]);

    const result = await refreshAssetPricesIfStale([makeAsset()], now);

    expect(priceCreateMock).not.toHaveBeenCalled();
    expect(result.get("asset-1")).toEqual({ price: 100, timestamp, isStale: true });
  });

  it("omits the asset entirely when it has no price and no quote could be fetched", async () => {
    priceFindManyMock.mockResolvedValue([]);
    getPriceProvidersMock.mockReturnValue([makeProvider({ fetchPrice: async () => null })]);

    const result = await refreshAssetPricesIfStale([makeAsset()]);

    expect(result.has("asset-1")).toBe(false);
  });
});

describe("refreshAssetPriceIfStale", () => {
  it("delegates to the batched refresh for a single asset", async () => {
    priceFindManyMock.mockResolvedValue([]);
    const quote = { price: 42, timestamp: new Date(), source: "test-provider" };
    getPriceProvidersMock.mockReturnValue([makeProvider({ fetchPrice: async () => quote })]);

    await refreshAssetPriceIfStale(makeAsset());

    expect(priceCreateMock).toHaveBeenCalled();
  });
});
