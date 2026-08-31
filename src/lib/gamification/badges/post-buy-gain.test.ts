import { describe, it, expect } from "vitest";
import { computeMaxPostBuyGainPct } from "./post-buy-gain";

const BUY_DATE = new Date("2026-09-01T00:00:00Z");

describe("computeMaxPostBuyGainPct", () => {
  it("retourne le meilleur gain dans la fenêtre de 5 jours", () => {
    const result = computeMaxPostBuyGainPct(
      [{ assetId: "a", price: 100, createdAt: BUY_DATE }],
      new Map([["a", [
        { price: 110, timestamp: new Date("2026-09-02T00:00:00Z") },
        { price: 125, timestamp: new Date("2026-09-04T00:00:00Z") },
      ]]]),
    );
    expect(result).toBe(25);
  });

  it("ignore les prix au-delà de 5 jours", () => {
    const result = computeMaxPostBuyGainPct(
      [{ assetId: "a", price: 100, createdAt: BUY_DATE }],
      new Map([["a", [{ price: 200, timestamp: new Date("2026-09-10T00:00:00Z") }]]]),
    );
    expect(result).toBeNull();
  });

  it("retourne null sans historique de prix", () => {
    expect(computeMaxPostBuyGainPct([{ assetId: "a", price: 100, createdAt: BUY_DATE }], new Map())).toBeNull();
  });
});
