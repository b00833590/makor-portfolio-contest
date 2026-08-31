import type { BadgeEvaluationContext } from "./types";

export const NOW = new Date("2026-09-15T12:00:00Z");

/** Fixture partagée par tous les tests de badges — un contexte neutre où aucun badge n'est attribué. */
export function baseContext(overrides: Partial<BadgeEvaluationContext> = {}): BadgeEvaluationContext {
  return {
    now: NOW,
    openPositionCount: 0,
    maxPositions: 20,
    investedValue: 0,
    positions: [],
    transactionCount: 0,
    firstTransactionDate: null,
    lastTransactionDate: null,
    closedTradesChronological: [],
    hasSuccessfulArbitrage: false,
    postBuyMaxGainPct: null,
    cumulativeReturnPct: 0,
    dailyReturnPct: null,
    currentRank: null,
    previousRank: null,
    gapToSecondPts: null,
    rankHistory: [],
    participantCount: 1,
    weeklyChangeWindows: [],
    currentStreakDays: 0,
    longestStreakDays: 0,
    fieldAverageReturnPct: 0,
    hasBestWeeklyReturn: false,
    distinctAssetsTradedCount: 0,
    holdsStockAndCrypto: false,
    maxPositionConcentrationPct: null,
    hasAnchorPosition: false,
    regainedFirstPlace: false,
    alreadyOwnedCodes: new Set(),
    totalBadgeCount: 40,
    ...overrides,
  };
}
