import { describe, it, expect } from "vitest";
import { marketSuffixFor, stripMarketSuffix } from "./market-suffix";

describe("marketSuffixFor", () => {
  it("returns the curated suffix for a known European exchange", () => {
    expect(marketSuffixFor("XPAR")).toBe(".PA");
    expect(marketSuffixFor("XETR")).toBe(".DE");
    expect(marketSuffixFor("XLON")).toBe(".L");
    expect(marketSuffixFor("XSTO")).toBe(".ST");
  });

  it("falls back to a dotted mic_code for an uncurated exchange", () => {
    expect(marketSuffixFor("XBKK")).toBe(".XBKK");
  });

  it("returns an empty suffix when no mic_code is given", () => {
    expect(marketSuffixFor(null)).toBe("");
    expect(marketSuffixFor(undefined)).toBe("");
  });
});

describe("stripMarketSuffix", () => {
  it("strips a known suffix that matches the mic_code", () => {
    expect(stripMarketSuffix("MC.PA", "XPAR")).toBe("MC");
    expect(stripMarketSuffix("SAP.DE", "XETR")).toBe("SAP");
  });

  it("strips a fallback dotted mic_code suffix", () => {
    expect(stripMarketSuffix("LVMH01.XBKK", "XBKK")).toBe("LVMH01");
  });

  it("returns the symbol unchanged when there is no mic_code", () => {
    expect(stripMarketSuffix("AAPL", null)).toBe("AAPL");
  });

  it("returns the symbol unchanged when it doesn't end with the expected suffix", () => {
    expect(stripMarketSuffix("MC", "XPAR")).toBe("MC");
  });
});
