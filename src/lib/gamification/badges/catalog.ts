import { performanceBadges } from "./performance";
import { tradingBadges } from "./trading";
import { riskManagementBadges } from "./risk-management";
import { diversificationBadges } from "./diversification";
import { rankingBadges } from "./ranking-badges";
import { specialEventBadges } from "./special-event";
import { distinctionBadges } from "./distinction";
import type { BadgeEvaluationContext, BadgeSpec } from "./types";

export const BADGE_CATALOG: BadgeSpec[] = [
  ...performanceBadges,
  ...rankingBadges,
  ...tradingBadges,
  ...riskManagementBadges,
  ...diversificationBadges,
  ...distinctionBadges,
  ...specialEventBadges,
];

export const BADGE_CATALOG_BY_CODE = new Map(BADGE_CATALOG.map((spec) => [spec.code, spec]));

/**
 * Badges « superlatifs » ou « tout le concours » : jamais évalués dans la boucle
 * standard, uniquement par award-close-only-badges.ts au passage ACTIVE → CLOSED.
 * Ce sont exactement les entrées du catalogue sans fonction `evaluate`.
 */
export const CLOSE_ONLY_CODES = new Set(BADGE_CATALOG.filter((spec) => !spec.evaluate).map((spec) => spec.code));

export function evaluateBadgeCatalog(ctx: BadgeEvaluationContext): string[] {
  return BADGE_CATALOG.filter((spec) => spec.evaluate?.(ctx) ?? false).map((spec) => spec.code);
}
