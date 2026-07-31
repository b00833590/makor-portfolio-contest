import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { PriceProvider, FetchedPrice } from "@/lib/prices/types";

const findManyMock = vi.fn();
const createMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    asset: { findMany: findManyMock },
    price: { create: createMock },
  },
}));

const { ingestAssetPrices } = await import("./ingest");

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
  findManyMock.mockReset();
  createMock.mockReset();
});

describe("ingestAssetPrices", () => {
  it("writes a price row for each active asset a provider supports", async () => {
    const asset = makeAsset();
    findManyMock.mockResolvedValue([asset]);
    const quote: FetchedPrice = { price: 123.45, timestamp: new Date(), source: "test-provider" };
    const provider = makeProvider({ fetchPrice: async () => quote });

    const results = await ingestAssetPrices([provider]);

    expect(results).toEqual([
      { assetId: asset.id, symbol: asset.symbol, status: "ok", price: quote.price },
    ]);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        assetId: asset.id,
        timestamp: quote.timestamp,
        price: quote.price,
        source: quote.source,
      },
    });
  });

  it("marks the asset unsupported when no provider matches", async () => {
    const asset = makeAsset({ type: AssetType.CRYPTO });
    findManyMock.mockResolvedValue([asset]);
    const stockOnlyProvider = makeProvider({ supports: (a) => a.type === AssetType.STOCK });

    const results = await ingestAssetPrices([stockOnlyProvider]);

    expect(results).toEqual([{ assetId: asset.id, symbol: asset.symbol, status: "unsupported" }]);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("marks the asset failed when the provider returns null", async () => {
    const asset = makeAsset();
    findManyMock.mockResolvedValue([asset]);
    const provider = makeProvider({ fetchPrice: async () => null });

    const results = await ingestAssetPrices([provider]);

    expect(results).toEqual([{ assetId: asset.id, symbol: asset.symbol, status: "failed" }]);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("marks the asset failed when the provider throws", async () => {
    const asset = makeAsset();
    findManyMock.mockResolvedValue([asset]);
    const provider = makeProvider({
      fetchPrice: async () => {
        throw new Error("network error");
      },
    });

    const results = await ingestAssetPrices([provider]);

    expect(results).toEqual([{ assetId: asset.id, symbol: asset.symbol, status: "failed" }]);
  });

  it("only queries active assets", async () => {
    findManyMock.mockResolvedValue([]);

    await ingestAssetPrices([makeProvider()]);

    expect(findManyMock).toHaveBeenCalledWith({ where: { isActive: true } });
  });
});
