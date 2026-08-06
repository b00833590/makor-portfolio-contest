import type { BadgeSpec } from "./types";

const ROI_DE_LA_SEMAINE_DAYS = 7;

/** Vrai si les `days` points de rang les plus récents (le plus récent en premier) valent tous 1. */
function isLeaderForConsecutiveDays(ctx: { rankHistory: { rank: number | null }[] }, days: number): boolean {
  if (ctx.rankHistory.length < days) return false;
  return ctx.rankHistory.slice(0, days).every((point) => point.rank === 1);
}

export const performanceBadges: BadgeSpec[] = [
  {
    code: "PREMIER_ENVOL",
    name: "Premier envol",
    description: "Votre portefeuille a dépassé +5% de rendement cumulé pour la première fois.",
    condition: "Dépasser +5% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "COMMON",
    icon: "🛫",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 5,
  },
  {
    code: "DANS_LE_VERT",
    name: "Dans le vert",
    description: "Votre portefeuille a atteint +10% de rendement cumulé.",
    condition: "Atteindre +10% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "RARE",
    icon: "📈",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 10,
  },
  {
    code: "AUTRE_PLANETE",
    name: "Sur une autre planète",
    description: "Votre portefeuille a atteint +20% de rendement cumulé.",
    condition: "Atteindre +20% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "EPIC",
    icon: "🪐",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 20,
  },
  {
    code: "SUR_LE_TOIT",
    name: "Sur le toit",
    description: "Vous avez atteint la 1ère place du classement.",
    condition: "Atteindre la 1ère place du classement, au moins une fois",
    category: "PERFORMANCE",
    rarity: "RARE",
    icon: "🥇",
    evaluate: (ctx) => ctx.currentRank === 1,
  },
  {
    code: "ROI_DE_LA_SEMAINE",
    name: "Roi(ne) de la semaine",
    description: "Vous êtes resté(e) en tête du classement 7 jours consécutifs.",
    condition: "Rester en tête du classement 7 jours consécutifs",
    category: "PERFORMANCE",
    rarity: "EPIC",
    icon: "👑",
    evaluate: (ctx) => isLeaderForConsecutiveDays(ctx, ROI_DE_LA_SEMAINE_DAYS),
  },
  {
    code: "LE_RETOUR",
    name: "Le grand retour",
    description: "Vous êtes revenu(e) dans le Top 3 après avoir été dernier du classement.",
    condition: "Revenir dans le Top 3 après avoir été dernier du classement",
    category: "PERFORMANCE",
    rarity: "EPIC",
    icon: "🔄",
    evaluate: (ctx) => {
      if (ctx.currentRank === null || ctx.currentRank > 3) return false;
      if (ctx.participantCount < 2) return false;
      return ctx.rankHistory.some((point) => point.rank === ctx.participantCount);
    },
  },
];
