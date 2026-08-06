import { describe, it, expect } from "vitest";
import { isStaleDuringMarketHours } from "./yahoo-provider";

// Session régulière observée en direct : 07:00 -> 15:30 UTC (Euronext), un jour donné.
const SESSION_START = 1786003200; // 07:00 UTC
const SESSION_END = SESSION_START + 8.5 * 60 * 60; // 15:30 UTC
const YESTERDAY_CLOSE = SESSION_START - 24 * 60 * 60;

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

  it("est vrai quand le flux s'est figé peu après l'ouverture du jour et n'a plus bougé depuis (cas européen observé)", () => {
    const openedAt = SESSION_START + 25 * 60; // figé 25 min après l'ouverture
    const now = new Date((SESSION_START + 7 * 60 * 60) * 1000); // 7h plus tard, session toujours ouverte
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: openedAt }), now)).toBe(true);
  });

  it("est faux pour un délai raisonnable de cotation gratuite (moins de 30 min)", () => {
    const quoteTime = SESSION_START + 60 * 60;
    const now = new Date((quoteTime + 15 * 60) * 1000); // 15 min de retard, normal pour un flux gratuit
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: quoteTime }), now)).toBe(false);
  });

  it("est faux quand regularMarketTime est quasiment à l'heure (cotation fraîche)", () => {
    const now = new Date((SESSION_START + 47 * 60) * 1000);
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: SESSION_START + 47 * 60 - 60 }), now)).toBe(false);
  });

  it("est faux avant l'ouverture de la session — la clôture de la veille est légitimement la donnée la plus récente", () => {
    const now = new Date((SESSION_START - 60 * 60) * 1000); // 1h avant l'ouverture
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: YESTERDAY_CLOSE }), now)).toBe(false);
  });

  it("est faux après la clôture de la session — le dernier prix connu est légitimement le prix de clôture", () => {
    const now = new Date((SESSION_END + 60 * 60) * 1000); // 1h après la clôture
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: SESSION_END - 60 }), now)).toBe(false);
  });

  it("est faux sans regularMarketTime (rien à évaluer)", () => {
    const now = new Date((SESSION_START + 60) * 1000);
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: undefined }), now)).toBe(false);
  });

  it("est faux sans currentTradingPeriod (impossible de déterminer la session — ne jamais bloquer par excès de prudence)", () => {
    const now = new Date((SESSION_START + 47 * 60) * 1000);
    expect(isStaleDuringMarketHours(meta({ regularMarketTime: YESTERDAY_CLOSE, hasTradingPeriod: false }), now)).toBe(
      false,
    );
  });
});
