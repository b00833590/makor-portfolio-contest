import type { BadgeSpec } from "./types";

const MIN_POSITIONS_FOR_RISK_BADGES = 3;
const SANG_FROID_MAX_LOSS_PCT = -5;
const SEMAINE_SANS_ACCROC_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function positionPnlPct(position: { marketValue: number; costBasis: number }): number {
  if (position.costBasis <= 0) return 0;
  return ((position.marketValue - position.costBasis) / position.costBasis) * 100;
}

export const riskManagementBadges: BadgeSpec[] = [
  {
    code: "SANG_FROID",
    name: "Sang-froid",
    description: "Aucune de vos positions n'est en perte de plus de 5%.",
    condition: "Aucune position en perte de plus de 5% (au moins 3 positions)",
    category: "RISK_MANAGEMENT",
    rarity: "RARE",
    icon: "🧊",
    evaluate: (ctx) =>
      ctx.positions.length >= MIN_POSITIONS_FOR_RISK_BADGES &&
      ctx.positions.every((position) => positionPnlPct(position) >= SANG_FROID_MAX_LOSS_PCT),
  },
  {
    code: "TOUT_AU_VERT",
    name: "Tout au vert",
    description: "Toutes vos positions ouvertes sont en gain simultanément.",
    condition: "Avoir toutes ses positions ouvertes en gain simultanément (au moins 3 positions)",
    category: "RISK_MANAGEMENT",
    rarity: "RARE",
    icon: "✳️",
    evaluate: (ctx) =>
      ctx.positions.length >= MIN_POSITIONS_FOR_RISK_BADGES &&
      ctx.positions.every((position) => positionPnlPct(position) >= 0),
  },
  {
    code: "SEMAINE_SANS_ACCROC",
    name: "Semaine sans accroc",
    description: "Aucune vente perdante au cours des 7 derniers jours.",
    condition: "Ne réaliser aucune vente perdante pendant 7 jours consécutifs",
    category: "RISK_MANAGEMENT",
    rarity: "EPIC",
    icon: "🛡️",
    evaluate: (ctx) => {
      const cutoff = ctx.now.getTime() - SEMAINE_SANS_ACCROC_DAYS * DAY_MS;
      const recentTrades = ctx.closedTradesChronological.filter((trade) => trade.closedAt.getTime() >= cutoff);
      if (recentTrades.length === 0) return false;
      return recentTrades.every((trade) => trade.pnlEur >= 0);
    },
  },
];

/** Close-only : calculé une seule fois à la clôture du concours (voir award-close-only-badges.ts). */
export const SANS_FAUTE: BadgeSpec = {
  code: "SANS_FAUTE",
  name: "Sans faute",
  description: "Aucune de vos positions n'a jamais dépassé -10% de perte, du début à la fin du concours.",
  condition: "Terminer le concours sans qu'aucune position n'ait jamais dépassé -10% de perte",
  category: "RISK_MANAGEMENT",
  rarity: "LEGENDARY",
  icon: "🦾",
};
