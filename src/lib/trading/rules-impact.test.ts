import { describe, it, expect } from "vitest";
import { AssetType } from "@/generated/prisma/enums";
import { defaultPromotionRules } from "@/lib/promotion-rules";
import { analyzeRulesImpact, analyzeEndDateImpact, type PortfolioImpactSnapshot } from "./rules-impact";

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

describe("analyzeEndDateImpact", () => {
  const NOW = new Date("2026-09-15T12:00:00Z");
  const CURRENT_END = new Date("2026-09-30T00:00:00Z");

  function base(overrides: Partial<Parameters<typeof analyzeEndDateImpact>[0]> = {}) {
    return analyzeEndDateImpact({
      newEndDate: CURRENT_END,
      currentEndDate: CURRENT_END,
      newFreezeHoursBeforeEnd: 48,
      currentFreezeHoursBeforeEnd: 48,
      now: NOW,
      changeSessions: [],
      ...overrides,
    });
  }

  it("returns no warnings when nothing actually changes", () => {
    expect(base()).toHaveLength(0);
  });

  it("warns when a scheduled session would now close after the new end date", () => {
    const warnings = base({
      newEndDate: new Date("2026-09-20T00:00:00Z"),
      changeSessions: [{ weekNumber: 3, closesAt: new Date("2026-09-25T00:00:00Z") }],
    });

    expect(warnings.some((w) => w.summary.includes("après la nouvelle date de fin"))).toBe(true);
  });

  it("does not warn about a session that closes before the new end date", () => {
    const warnings = base({
      newEndDate: new Date("2026-09-28T00:00:00Z"),
      changeSessions: [{ weekNumber: 3, closesAt: new Date("2026-09-20T00:00:00Z") }],
    });

    expect(warnings.some((w) => w.summary.includes("après la nouvelle date de fin"))).toBe(false);
  });

  it("warns when the new end date has already passed", () => {
    const warnings = base({ newEndDate: new Date("2026-09-10T00:00:00Z") });

    expect(warnings.some((w) => w.summary.includes("déjà passée"))).toBe(true);
  });

  it("warns when moving the end date earlier triggers the freeze immediately", () => {
    // NOW is 12:00 on the 15th; end date moved to the 16th with a 48h freeze means
    // the freeze window (16th 00:00 - 48h = 14th 00:00) already started.
    const warnings = base({ newEndDate: new Date("2026-09-16T00:00:00Z") });

    expect(warnings.some((w) => w.summary.includes("gel des positions"))).toBe(true);
  });

  it("warns when only widening the freeze window (not the end date) triggers it immediately", () => {
    // End date unchanged (30th), but freeze widened to 400h — freeze window now starts
    // well before "now", even though it didn't with the original 48h freeze.
    const warnings = base({ newFreezeHoursBeforeEnd: 400 });

    expect(warnings.some((w) => w.summary.includes("gel des positions"))).toBe(true);
  });

  it("does not warn about the freeze when it was already active before this change", () => {
    // Both old and new configs already have the freeze active — not a new consequence of this change.
    const warnings = base({
      currentEndDate: new Date("2026-09-16T00:00:00Z"),
      newEndDate: new Date("2026-09-17T00:00:00Z"),
    });

    expect(warnings.some((w) => w.summary.includes("gel des positions"))).toBe(false);
  });

  it("does not warn about overrunning sessions when only the freeze window changes", () => {
    const warnings = base({
      newFreezeHoursBeforeEnd: 60,
      changeSessions: [{ weekNumber: 3, closesAt: new Date("2026-10-05T00:00:00Z") }],
    });

    expect(warnings.some((w) => w.summary.includes("après la nouvelle date de fin"))).toBe(false);
  });
});
