import type { BadgeSpec } from "./types";

const MULTI_SECTEURS_MIN_SECTORS = 5;
const TOUR_DU_MONDE_MIN_CURRENCIES = 2;

export const diversificationBadges: BadgeSpec[] = [
  {
    code: "PORTEFEUILLE_COMPLET",
    name: "Portefeuille complet",
    description: "Vous avez atteint le nombre maximal de positions autorisées.",
    condition: "Atteindre le nombre maximal de positions autorisées",
    category: "DIVERSIFICATION",
    rarity: "COMMON",
    icon: "🧱",
    evaluate: (ctx) => ctx.maxPositions > 0 && ctx.openPositionCount >= ctx.maxPositions,
  },
  {
    code: "MULTI_SECTEURS",
    name: "Multi-secteurs",
    description: "Vous investissez simultanément dans au moins 5 secteurs différents.",
    condition: "Investir simultanément dans au moins 5 secteurs différents",
    category: "DIVERSIFICATION",
    rarity: "RARE",
    icon: "🧭",
    evaluate: (ctx) => ctx.sectorAllocation.length >= MULTI_SECTEURS_MIN_SECTORS,
  },
  {
    code: "TOUR_DU_MONDE",
    name: "Tour du monde",
    description: "Vous détenez des positions libellées dans au moins 2 devises différentes.",
    condition: "Détenir des positions dans au moins 2 devises différentes",
    category: "DIVERSIFICATION",
    rarity: "RARE",
    icon: "🌍",
    evaluate: (ctx) => ctx.currencyAllocation.length >= TOUR_DU_MONDE_MIN_CURRENCIES,
  },
];
