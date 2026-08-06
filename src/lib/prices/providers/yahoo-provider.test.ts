import { describe, it, expect } from "vitest";
import { isStaleDuringMarketHours } from "./yahoo-provider";

// Session régulière NVDA du 2026-08-06 (observée en direct) : 13:30 -> 20:00 UTC.
const SESSION_START = 1786023000; // 2026-08-06T13:30:00Z
const SESSION_END = 1786046400; // 2026-08-06T20:00:00Z
const YESTERDAY_CLOSE = 1785960000; // 2026-08-05T20:00:00Z

function meta(overrides: { regularMarketTime?: number; hasTradingPeriod?: boolean } = {}) {
  return {
    regularMarketTime: overrides.regularMarketTime,
    currentTradingPeriod:
      overrides.hasTradingPeriod === false ? undefined : { regular: { start: SESSION_START, end: SESSION_END } },
  };
}

describe("isStaleDuringMarketHours", () => {
  it("est vrai quand regularMarketTime est la clôture de la veille alors que la session du jour est déjà ouverte", () => {
    const now = new Date((SESSION_START + 47 * 60) * 1000); // 47 min après l'ouverture
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: YESTERDAY_CLOSE }), now)).toBe(true);
  });

  it("est faux quand regularMarketTime est postérieur ou égal à l'ouverture de la session (cotation fraîche)", () => {
    const now = new Date((SESSION_START + 47 * 60) * 1000);
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: SESSION_START + 60 }), now)).toBe(false);
  });

  it("est faux avant l'ouverture de la session — la clôture de la veille est légitimement la donnée la plus récente", () => {
    const now = new Date((SESSION_START - 60 * 60) * 1000); // 1h avant l'ouverture
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: YESTERDAY_CLOSE }), now)).toBe(false);
  });

  it("est faux sans regularMarketTime (rien à évaluer)", () => {
    const now = new Date((SESSION_START + 60) * 1000);
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: undefined }), now)).toBe(false);
  });

  it("est faux sans currentTradingPeriod (impossible de déterminer l'ouverture — ne jamais bloquer par excès de prudence)", () => {
    const now = new Date((SESSION_START + 47 * 60) * 1000);
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: YESTERDAY_CLOSE, hasTradingPeriod: false }), now)).toBe(
      false,
    );
  });

  it("est faux exactement à l'ouverture si regularMarketTime vaut déjà l'heure d'ouverture", () => {
    const now = new Date(SESSION_START * 1000);
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: SESSION_START }), now)).toBe(false);
  });
});
