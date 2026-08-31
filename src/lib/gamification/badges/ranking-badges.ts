import type { BadgeSpec } from "./types";

const REGNE_DAYS = 5;
const REMONTADA_MIN_RANK_GAIN = 5;
const DOMINATION_MIN_GAP_PTS = 8;
const FUSEE_MIN_DAILY_RETURN_PCT = 8;
const PODIUM_MIN_PARTICIPANTS = 4;

/** Vrai si les `days` points de rang les plus récents (le plus récent en premier) valent tous 1. */
export function isLeaderForConsecutiveDays(ctx: { rankHistory: { rank: number | null }[] }, days: number): boolean {
  if (ctx.rankHistory.length < days) return false;
  return ctx.rankHistory.slice(0, days).every((point) => point.rank === 1);
}

export const rankingBadges: BadgeSpec[] = [
  {
    code: "SUR_LE_PODIUM",
    name: "Sur le podium",
    description: "Vous avez atteint le Top 3 du classement.",
    condition: "Atteindre le Top 3 du classement au moins une fois",
    category: "RANKING",
    rarity: "RARE",
    icon: "🥉",
    evaluate: (ctx) =>
      ctx.currentRank !== null && ctx.currentRank <= 3 && ctx.participantCount >= PODIUM_MIN_PARTICIPANTS,
  },
  {
    code: "SUR_LE_TOIT",
    name: "Sur le toit",
    description: "Vous avez atteint la 1ère place du classement.",
    condition: "Atteindre la 1ère place du classement au moins une fois",
    category: "RANKING",
    rarity: "EPIC",
    icon: "🥇",
    evaluate: (ctx) => ctx.currentRank === 1 && ctx.participantCount >= 3,
  },
  {
    code: "CHASSEUR_DE_TETE",
    name: "Chasseur de tête",
    description: "Vous avez repris la 1ère place après l'avoir perdue.",
    condition: "Reprendre la 1ère place après l'avoir perdue au moins un jour",
    category: "RANKING",
    rarity: "RARE",
    icon: "🎯",
    evaluate: (ctx) => ctx.regainedFirstPlace,
  },
  {
    code: "MEILLEURE_SEMAINE",
    name: "Meilleure semaine",
    description: "Vous avez signé le meilleur rendement de tous les participants sur 7 jours.",
    condition: "Avoir le meilleur rendement sur 7 jours de tous les participants",
    category: "RANKING",
    rarity: "EPIC",
    icon: "📅",
    evaluate: (ctx) => ctx.hasBestWeeklyReturn,
  },
  {
    code: "FUSEE",
    name: "Fusée",
    description: "Vous avez réalisé une progression d'au moins +8% en une seule journée.",
    condition: "Réaliser une progression d'au moins +8% en une seule journée",
    category: "RANKING",
    rarity: "EPIC",
    icon: "🚀",
    evaluate: (ctx) => ctx.dailyReturnPct !== null && ctx.dailyReturnPct >= FUSEE_MIN_DAILY_RETURN_PCT,
  },
  {
    code: "REMONTADA",
    name: "Remontada",
    description: "Vous avez gagné au moins 5 places au classement en une seule journée.",
    condition: "Gagner au moins 5 places au classement en une seule journée",
    category: "RANKING",
    rarity: "EPIC",
    icon: "🐎",
    evaluate: (ctx) => {
      if (ctx.currentRank === null || ctx.previousRank === null) return false;
      return ctx.previousRank - ctx.currentRank >= REMONTADA_MIN_RANK_GAIN;
    },
  },
  {
    code: "DOMINATION",
    name: "Domination",
    description: "Vous êtes 1er du classement avec au moins 8 points d'avance sur le 2e.",
    condition: "Être 1er du classement avec au moins 8 points d'avance sur le 2e",
    category: "RANKING",
    rarity: "EPIC",
    icon: "👊",
    evaluate: (ctx) =>
      ctx.currentRank === 1 && ctx.gapToSecondPts !== null && ctx.gapToSecondPts >= DOMINATION_MIN_GAP_PTS,
  },
  {
    code: "REGNE",
    name: "Règne",
    description: "Vous êtes resté(e) en tête du classement 5 jours consécutifs.",
    condition: "Rester en tête du classement 5 jours consécutifs",
    category: "RANKING",
    rarity: "EPIC",
    icon: "👑",
    evaluate: (ctx) => isLeaderForConsecutiveDays(ctx, REGNE_DAYS),
  },
];
