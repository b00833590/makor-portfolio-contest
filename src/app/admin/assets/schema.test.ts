import { describe, it, expect } from "vitest";
import { createAssetSchema } from "./schema";

describe("createAssetSchema", () => {
  it("uppercases the symbol and currency", () => {
    const result = createAssetSchema.safeParse({
      symbol: "aapl",
      name: "Apple Inc.",
      type: "STOCK",
      currency: "usd",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.symbol).toBe("AAPL");
    expect(result.success && result.data.currency).toBe("USD");
  });

  it("rejects an invalid asset type", () => {
    const result = createAssetSchema.safeParse({
      symbol: "AAPL",
      name: "Apple Inc.",
      type: "BOND",
      currency: "USD",
    });

    expect(result.success).toBe(false);
  });

  it("allows the sector to be omitted", () => {
    const result = createAssetSchema.safeParse({
      symbol: "SPY",
      name: "SPDR S&P 500",
      type: "ETF",
      currency: "USD",
    });

    expect(result.success).toBe(true);
  });
});
