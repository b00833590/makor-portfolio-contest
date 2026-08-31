import type { BadgeSpec } from "./types";

const MIN_POSITIONS_FOR_RISK_BADGES = 5;
const SANG_FROID_MAX_LOSS_PCT = -5;

export function positionPnlPct(position: { marketValue: number; costBasis: number }): number {
  if (position.costBasis <= 0) return 0;
  return ((position.marketValue - position.costBasis) / position.costBasis) * 100;
}

export const riskManagementBadges: BadgeSpec[] = [
  {
    code: "SANG_FROID",
    name: "Sang-froid",
    description: "Aucune de vos positions n'est en perte de plus de 5%.",
    condition: "Aucune position en perte de plus de 5% (au moins 5 positions)",
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
    condition: "Avoir toutes ses positions ouvertes en gain simultanément (au moins 5 positions)",
    category: "RISK_MANAGEMENT",
    rarity: "EPIC",
    icon: "✳️",
    evaluate: (ctx) =>
      ctx.positions.length >= MIN_POSITIONS_FOR_RISK_BADGES &&
      ctx.positions.every((position) => positionPnlPct(position) >= 0),
  },
  {
    code: "PIERRE_ANGULAIRE",
    name: "Pierre angulaire",
    description: "Vous avez gardé une position en gain de plus de 10% pendant plus de 3 semaines sans y toucher.",
    condition: "Garder une position en gain de +10% pendant au moins 3 semaines sans la renforcer ni l'alléger",
    category: "RISK_MANAGEMENT",
    rarity: "RARE",
    icon: "💠",
    evaluate: (ctx) => ctx.hasAnchorPosition,
  },
];
