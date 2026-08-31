import type { BadgeSpec } from "./types";

const ALPHA_MIN_OUTPERFORMANCE_PTS = 12;
const ALPHA_MIN_PARTICIPANTS = 3;

export const performanceBadges: BadgeSpec[] = [
  {
    code: "PREMIER_ENVOL",
    name: "Premier envol",
    description: "Votre portefeuille a dépassé +3% de rendement cumulé pour la première fois.",
    condition: "Dépasser +3% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "COMMON",
    icon: "🛫",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 3,
  },
  {
    code: "DANS_LE_VERT",
    name: "Dans le vert",
    description: "Votre portefeuille a atteint +8% de rendement cumulé.",
    condition: "Atteindre +8% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "RARE",
    icon: "📈",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 8,
  },
  {
    code: "SURPERFORMANCE",
    name: "Surperformance",
    description: "Votre portefeuille a atteint +18% de rendement cumulé.",
    condition: "Atteindre +18% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "EPIC",
    icon: "🪐",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 18,
  },
  {
    code: "AUTRE_GALAXIE",
    name: "Autre galaxie",
    description: "Votre portefeuille a atteint +28% de rendement cumulé.",
    condition: "Atteindre +28% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "LEGENDARY",
    icon: "🌌",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 28,
  },
  {
    code: "ALPHA",
    name: "Alpha",
    description: "Votre rendement dépasse la moyenne du concours de plus de 12 points.",
    condition: "Battre la moyenne de rendement du concours de plus de 12 points",
    category: "PERFORMANCE",
    rarity: "RARE",
    icon: "📊",
    evaluate: (ctx) =>
      ctx.participantCount >= ALPHA_MIN_PARTICIPANTS &&
      ctx.cumulativeReturnPct - ctx.fieldAverageReturnPct >= ALPHA_MIN_OUTPERFORMANCE_PTS,
  },
];
