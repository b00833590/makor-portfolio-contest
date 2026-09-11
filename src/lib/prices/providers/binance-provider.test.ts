import { describe, it, expect } from "vitest";
import { resolveBridgedPrice } from "./binance-provider";

describe("resolveBridgedPrice", () => {
  it("utilise le prix direct quand la paire <SYMBOL><CURRENCY> existe (ex. BTCEUR)", () => {
    expect(
      resolveBridgedPrice({ symbol: "BTC", currency: "EUR", directPrice: 66433.21, assetInBridge: null, currencyInBridge: null }),
    ).toBe(66433.21);
  });

  it("bascule sur le pont quand la paire directe n'existe pas (cas réel : USDCEUR répond HTTP 400 sur Binance)", () => {
    // USDC/USDT = 1.0002, EUR/USDT = 1.1597 -> USDC en EUR = 1.0002 / 1.1597
    const price = resolveBridgedPrice({
      symbol: "USDC",
      currency: "EUR",
      directPrice: null,
      assetInBridge: 1.0002,
      currencyInBridge: 1.1597,
    });
    expect(price).toBeCloseTo(1.0002 / 1.1597, 10);
  });

  it("gère le cas où l'actif EST lui-même le pont, sans paire USDTUSDT (bug rapporté : achat d'USDT bloqué)", () => {
    // Pas de cotation "USDTUSDT" à récupérer (assetInBridge non fourni) : le prix d'1 USDT
    // en EUR se déduit directement du cross EUR/USDT.
    const price = resolveBridgedPrice({
      symbol: "USDT",
      currency: "EUR",
      directPrice: null,
      assetInBridge: null,
      currencyInBridge: 1.1597,
    });
    expect(price).toBeCloseTo(1 / 1.1597, 10);
  });

  it("ignore un éventuel assetInBridge fourni par erreur quand l'actif est le pont (le cross EUR/USDT prime toujours)", () => {
    const price = resolveBridgedPrice({
      symbol: "usdt",
      currency: "eur",
      directPrice: null,
      assetInBridge: 42, // ne devrait jamais être utilisé pour le pont lui-même
      currencyInBridge: 1.1597,
    });
    expect(price).toBeCloseTo(1 / 1.1597, 10);
  });

  it("retourne null si le cross-rate de la devise (<CURRENCY>USDT) est indisponible", () => {
    expect(
      resolveBridgedPrice({ symbol: "BTC", currency: "EUR", directPrice: null, assetInBridge: 70000, currencyInBridge: null }),
    ).toBeNull();
  });

  it("retourne null si le cross-rate de l'actif (<SYMBOL>USDT) est indisponible pour un actif non-pont", () => {
    expect(
      resolveBridgedPrice({ symbol: "BTC", currency: "EUR", directPrice: null, assetInBridge: null, currencyInBridge: 1.1597 }),
    ).toBeNull();
  });

  it("retourne null si le cross-rate de la devise est 0 (évite une division par zéro)", () => {
    expect(
      resolveBridgedPrice({ symbol: "BTC", currency: "EUR", directPrice: null, assetInBridge: 70000, currencyInBridge: 0 }),
    ).toBeNull();
  });
});
