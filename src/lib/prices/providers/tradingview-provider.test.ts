import { describe, it, expect } from "vitest";
import { toTradingViewSymbol } from "./tradingview-provider";

describe("toTradingViewSymbol", () => {
  it("convertit un ticker Euronext Paris", () => {
    expect(toTradingViewSymbol("MC.PA")).toBe("EURONEXT:MC");
  });

  it("convertit un ticker Euronext Amsterdam", () => {
    expect(toTradingViewSymbol("AALB.AS")).toBe("EURONEXT:AALB");
  });

  it("convertit un ticker Xetra", () => {
    expect(toTradingViewSymbol("RHM.DE")).toBe("XETR:RHM");
  });

  it("convertit un ticker Swiss SIX", () => {
    expect(toTradingViewSymbol("COTN.SW")).toBe("SIX:COTN");
  });

  it("convertit un ticker LSE en préservant le point interne du ticker (ex. BAE Systems)", () => {
    expect(toTradingViewSymbol("BA.L")).toBe("LSE:BA.");
  });

  it("convertit un ticker Stockholm avec classe d'action, tiret -> underscore", () => {
    expect(toTradingViewSymbol("SECT-B.ST")).toBe("OMXSTO:SECT_B");
  });

  it("convertit un ticker Stockholm sans classe d'action (pas de tiret à remplacer)", () => {
    expect(toTradingViewSymbol("SYSR.ST")).toBe("OMXSTO:SYSR");
  });

  it("retourne null pour un ticker US sans suffixe de bourse", () => {
    expect(toTradingViewSymbol("AAPL")).toBe(null);
  });

  it("retourne null pour un suffixe non couvert par la table de correspondance", () => {
    expect(toTradingViewSymbol("000660.KS")).toBe(null);
  });

  it("retourne null si le ticker est réduit à une chaîne vide après retrait du suffixe", () => {
    expect(toTradingViewSymbol(".PA")).toBe(null);
  });
});
