import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";

const findUniqueMock = vi.fn();
const findFirstMock = vi.fn();
const createMock = vi.fn();
const priceFindFirstMock = vi.fn();
const refreshAssetPriceIfStaleMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    asset: { findUnique: findUniqueMock, findFirst: findFirstMock, create: createMock },
    price: { findFirst: priceFindFirstMock },
  },
}));

vi.mock("@/lib/prices/pull-through", () => ({
  refreshAssetPriceIfStale: refreshAssetPriceIfStaleMock,
}));

const { ensureAssetForPurchase } = await import("./ensure-asset");

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

beforeEach(() => {
  findUniqueMock.mockReset();
  findFirstMock.mockReset();
  createMock.mockReset();
  priceFindFirstMock.mockReset();
  refreshAssetPriceIfStaleMock.mockReset();
});

describe("ensureAssetForPurchase", () => {
  it("reuses an existing asset instead of creating a new one", async () => {
    const asset = makeAsset();
    findUniqueMock.mockResolvedValue(asset);
    priceFindFirstMock.mockResolvedValue({ id: "price-1" });

    const result = await ensureAssetForPurchase({ symbol: "aapl", name: "Apple Inc.", type: AssetType.STOCK });

    expect(createMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, asset });
  });

  it("creates a new asset when the symbol doesn't exist yet", async () => {
    findUniqueMock.mockResolvedValue(null);
    const created = makeAsset({ symbol: "TSLA", name: "Tesla Inc." });
    createMock.mockResolvedValue(created);
    priceFindFirstMock.mockResolvedValue({ id: "price-1" });

    const result = await ensureAssetForPurchase({ symbol: "tsla", name: "Tesla Inc.", type: AssetType.STOCK });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        symbol: "TSLA",
        name: "Tesla Inc.",
        type: AssetType.STOCK,
        currency: "EUR",
        externalId: undefined,
        logoUrl: undefined,
      },
    });
    expect(result).toEqual({ ok: true, asset: created });
  });

  it("creates a new crypto asset even when another crypto is already active in the catalog", async () => {
    findUniqueMock.mockResolvedValue(null);
    const created = makeAsset({ type: AssetType.CRYPTO, symbol: "ETH", externalId: "ethereum" });
    createMock.mockResolvedValue(created);
    priceFindFirstMock.mockResolvedValue({ id: "price-1" });

    const result = await ensureAssetForPurchase({
      symbol: "eth",
      name: "Ethereum",
      type: AssetType.CRYPTO,
      externalId: "ethereum",
    });

    expect(findFirstMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, asset: created });
  });

  it("rejects an asset that has been deactivated by the admin", async () => {
    findUniqueMock.mockResolvedValue(makeAsset({ isActive: false }));

    const result = await ensureAssetForPurchase({ symbol: "aapl", name: "Apple Inc.", type: AssetType.STOCK });

    expect(result).toEqual({ ok: false, error: expect.stringContaining("disponible") });
    expect(refreshAssetPriceIfStaleMock).not.toHaveBeenCalled();
  });

  it("rejects when no quote can be obtained after refresh", async () => {
    findUniqueMock.mockResolvedValue(makeAsset());
    priceFindFirstMock.mockResolvedValue(null);

    const result = await ensureAssetForPurchase({ symbol: "aapl", name: "Apple Inc.", type: AssetType.STOCK });

    expect(refreshAssetPriceIfStaleMock).toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: expect.stringContaining("cotation") });
  });
});
