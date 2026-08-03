import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import type { PriceProvider } from "@/lib/prices/types";

const priceFindManyMock = vi.fn();
const getPriceProvidersMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { price: { findMany: priceFindManyMock } },
}));

vi.mock("@/lib/prices", () => ({
  getPriceProviders: getPriceProvidersMock,
}));

const { getAssetPriceHistory } = await import("./get-asset-price-history");

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
    fetchPrice: async () => null,
    ...overrides,
  };
}

beforeEach(() => {
  priceFindManyMock.mockReset();
  getPriceProvidersMock.mockReset();
});

describe("getAssetPriceHistory", () => {
  it("returns the provider's history when available", async () => {
    const points = [{ timestamp: new Date("2026-01-01T00:00:00Z"), price: 100 }];
    getPriceProvidersMock.mockReturnValue([makeProvider({ fetchHistory: async () => points })]);

    const result = await getAssetPriceHistory(makeAsset(), "1M");

    expect(result).toEqual({ points, isFromProvider: true });
    expect(priceFindManyMock).not.toHaveBeenCalled();
  });

  it("falls back to the internal Price table when the provider returns nothing", async () => {
    const now = new Date("2026-01-10T00:00:00Z");
    getPriceProvidersMock.mockReturnValue([makeProvider({ fetchHistory: async () => null })]);
    priceFindManyMock.mockResolvedValue([{ timestamp: new Date("2026-01-05T00:00:00Z"), price: 120 }]);

    const result = await getAssetPriceHistory(makeAsset(), "1W", { now });

    expect(result).toEqual({ points: [{ timestamp: new Date("2026-01-05T00:00:00Z"), price: 120 }], isFromProvider: false });
    expect(priceFindManyMock).toHaveBeenCalledWith({
      where: { assetId: "asset-1", timestamp: { gte: new Date("2026-01-03T00:00:00Z"), lte: now } },
      orderBy: { timestamp: "asc" },
    });
  });

  it("falls back to the internal Price table when no provider supports the asset", async () => {
    getPriceProvidersMock.mockReturnValue([makeProvider({ supports: () => false })]);
    priceFindManyMock.mockResolvedValue([]);

    const result = await getAssetPriceHistory(makeAsset(), "1D");

    expect(result.isFromProvider).toBe(false);
  });

  it("requests roughly the elapsed days since purchase for the SINCE_PURCHASE period", async () => {
    const now = new Date("2026-01-11T00:00:00Z");
    const purchasedAt = new Date("2026-01-01T00:00:00Z");
    const fetchHistory = vi.fn().mockResolvedValue([{ timestamp: now, price: 10 }]);
    getPriceProvidersMock.mockReturnValue([makeProvider({ fetchHistory })]);

    await getAssetPriceHistory(makeAsset(), "SINCE_PURCHASE", { purchasedAt, now });

    expect(fetchHistory).toHaveBeenCalledWith(expect.anything(), { days: 10, interval: "auto" });
  });

  it("clamps SINCE_PURCHASE to at least 1 day", async () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const purchasedAt = new Date("2026-01-01T00:00:00Z");
    const fetchHistory = vi.fn().mockResolvedValue([{ timestamp: now, price: 10 }]);
    getPriceProvidersMock.mockReturnValue([makeProvider({ fetchHistory })]);

    await getAssetPriceHistory(makeAsset(), "SINCE_PURCHASE", { purchasedAt, now });

    expect(fetchHistory).toHaveBeenCalledWith(expect.anything(), { days: 1, interval: "auto" });
  });
});
