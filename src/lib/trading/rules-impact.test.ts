import { describe, it, expect } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import { defaultPromotionRules } from "@/lib/promotion-rules";
import { analyzeRulesImpact, type PortfolioImpactSnapshot } from "./rules-impact";

function portfolio(participantName: string, positions: PortfolioImpactSnapshot["positions"]): PortfolioImpactSnapshot {
  return { participantName, positions };
}

describe("analyzeRulesImpact", () => {
  it("returns no warnings when nothing changes and nobody is affected", () => {
    const portfolios = [portfolio("Alice", [{ symbol: "AAPL", assetType: AssetType.STOCK, quantity: 100, currentPrice: 500 }])];

    const warnings = analyzeRulesImpact(defaultPromotionRules, portfolios);

    expect(warnings).toHaveLength(0);
  });

  it("warns when lowering maxCryptoPositions below what a participant already holds", () => {
    const portfolios = [
      portfolio("Alice", [
        { symbol: "BTC", assetType: AssetType.CRYPTO, quantity: 1, currentPrice: 60_000 },
        { symbol: "ETH", assetType: AssetType.CRYPTO, quantity: 10, currentPrice: 3_000 },
      ]),
    ];

    const warnings = analyzeRulesImpact({ ...defaultPromotionRules, maxCryptoPositions: 1 }, portfolios);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe("maxCryptoPositions");
    expect(warnings[0].summary).toContain("1 participant");
    expect(warnings[0].details.join(" ")).toContain("Alice");
  });

  it("does not warn when a participant is exactly at the new crypto limit", () => {
    const portfolios = [portfolio("Alice", [{ symbol: "BTC", assetType: AssetType.CRYPTO, quantity: 1, currentPrice: 60_000 }])];

    const warnings = analyzeRulesImpact({ ...defaultPromotionRules, maxCryptoPositions: 1 }, portfolios);

    expect(warnings).toHaveLength(0);
  });

  it("warns when lowering maxPositions below a participant's open position count", () => {
    const portfolios = [
      portfolio("Bob", [
        { symbol: "AAPL", assetType: AssetType.STOCK, quantity: 100, currentPrice: 300 },
        { symbol: "MSFT", assetType: AssetType.STOCK, quantity: 50, currentPrice: 400 },
        { symbol: "GOOGL", assetType: AssetType.STOCK, quantity: 20, currentPrice: 350 },
      ]),
    ];

    const warnings = analyzeRulesImpact({ ...defaultPromotionRules, maxPositions: 2 }, portfolios);

    expect(warnings.some((w) => w.field === "maxPositions")).toBe(true);
  });

  it("warns when raising minPositionSize above an open position's current value", () => {
    const portfolios = [portfolio("Chloé", [{ symbol: "AAPL", assetType: AssetType.STOCK, quantity: 10, currentPrice: 100 }])];

    const warnings = analyzeRulesImpact({ ...defaultPromotionRules, minPositionSize: 5_000 }, portfolios);

    expect(warnings.some((w) => w.field === "minPositionSize")).toBe(true);
  });

  it("warns when lowering maxPositionSize below an open position's current value", () => {
    const portfolios = [portfolio("Chloé", [{ symbol: "AAPL", assetType: AssetType.STOCK, quantity: 1_000, currentPrice: 500 }])];

    const warnings = analyzeRulesImpact({ ...defaultPromotionRules, maxPositionSize: 10_000 }, portfolios);

    expect(warnings.some((w) => w.field === "maxPositionSize")).toBe(true);
  });

  it("summarizes and caps a long list of affected participants", () => {
    const portfolios = Array.from({ length: 8 }, (_, i) =>
      portfolio(`Participant ${i}`, [{ symbol: "BTC", assetType: AssetType.CRYPTO, quantity: 1, currentPrice: 1 }]),
    );

    const warnings = analyzeRulesImpact({ ...defaultPromotionRules, maxCryptoPositions: 0 }, portfolios);

    expect(warnings[0].details[0]).toContain("et 3 autre(s)");
  });
});
