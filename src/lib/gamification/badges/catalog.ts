import { performanceBadges } from "./performance";
import { tradingBadges } from "./trading";
import { riskManagementBadges, SANS_FAUTE } from "./risk-management";
import { convictionBadges, FIDELE_AU_POSTE } from "./conviction";
import { diversificationBadges } from "./diversification";
import { rankingBadges, LE_PHENIX } from "./ranking-badges";
import { specialEventBadges, STRATEGE_ASSIDU } from "./special-event";
import { distinctionBadges } from "./distinction";
import type { BadgeEvaluationContext, BadgeSpec } from "./types";

export const BADGE_CATALOG: BadgeSpec[] = [
  ...performanceBadges,
  ...tradingBadges,
  ...riskManagementBadges,
  SANS_FAUTE,
  ...convictionBadges,
  FIDELE_AU_POSTE,
  ...diversificationBadges,
  ...rankingBadges,
  LE_PHENIX,
  ...specialEventBadges,
  STRATEGE_ASSIDU,
  ...distinctionBadges,
];

export const BADGE_CATALOG_BY_CODE = new Map(BADGE_CATALOG.map((spec) => [spec.code, spec]));

/**
 * Badges "superlatifs" qui ne peuvent être déterminés qu'à la clôture du concours (le meilleur
 * X, ou une condition portant sur "tout le concours" qui ne peut être confirmée qu'une fois
 * terminée) — jamais évalués dans la boucle standard, uniquement par
 * award-close-only-badges.ts au passage ACTIVE → CLOSED.
 */
export const CLOSE_ONLY_CODES = new Set(
  [SANS_FAUTE, FIDELE_AU_POSTE, LE_PHENIX, STRATEGE_ASSIDU, ...distinctionBadges].map((spec) => spec.code),
);

export function evaluateBadgeCatalog(ctx: BadgeEvaluationContext): string[] {
  return BADGE_CATALOG.filter((spec) => spec.evaluate?.(ctx) ?? false).map((spec) => spec.code);
}
