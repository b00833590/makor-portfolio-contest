import type { BadgeSpec } from "./types";

const RIEN_DANS_UN_PANIER_MIN_POSITIONS = 8;
const RIEN_DANS_UN_PANIER_MAX_CONCENTRATION_PCT = 12;
const COLLECTIONNEUR_MIN_ASSETS = 25;

export const diversificationBadges: BadgeSpec[] = [
  {
    code: "PORTEFEUILLE_COMPLET",
    name: "Portefeuille garni",
    description: "Vous avez atteint le nombre maximal de positions autorisées.",
    condition: "Atteindre le nombre maximal de positions autorisées",
    category: "DIVERSIFICATION",
    rarity: "COMMON",
    icon: "🧱",
    evaluate: (ctx) => ctx.maxPositions > 0 && ctx.openPositionCount >= ctx.maxPositions,
  },
  {
    code: "RIEN_DANS_UN_PANIER",
    name: "Rien dans un seul panier",
    description: "Aucune de vos positions ne pèse plus de 12% de votre portefeuille.",
    condition: "Aucune position ne dépasse 12% du portefeuille (au moins 8 positions)",
    category: "DIVERSIFICATION",
    rarity: "RARE",
    icon: "⚖️",
    evaluate: (ctx) =>
      ctx.openPositionCount >= RIEN_DANS_UN_PANIER_MIN_POSITIONS &&
      ctx.maxPositionConcentrationPct !== null &&
      ctx.maxPositionConcentrationPct <= RIEN_DANS_UN_PANIER_MAX_CONCENTRATION_PCT,
  },
  {
    code: "TOUCHE_A_TOUT",
    name: "Touche-à-tout",
    description: "Vous détenez des actions et de la crypto en même temps.",
    condition: "Détenir simultanément au moins une action et une cryptomonnaie",
    category: "DIVERSIFICATION",
    rarity: "COMMON",
    icon: "🪙",
    evaluate: (ctx) => ctx.holdsStockAndCrypto,
  },
  {
    code: "COLLECTIONNEUR",
    name: "Collectionneur",
    description: "Vous avez détenu au moins 25 actifs différents au fil du concours.",
    condition: "Avoir détenu au moins 25 actifs différents au cours du concours",
    category: "DIVERSIFICATION",
    rarity: "RARE",
    icon: "🗂️",
    evaluate: (ctx) => ctx.distinctAssetsTradedCount >= COLLECTIONNEUR_MIN_ASSETS,
  },
];
