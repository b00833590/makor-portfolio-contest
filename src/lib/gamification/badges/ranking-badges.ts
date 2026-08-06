import type { BadgeSpec } from "./types";

const FUSEE_MIN_DAILY_RETURN_PCT = 8;
const REMONTADA_MIN_RANK_GAIN = 5;
const DOMINATION_MIN_GAP_PTS = 10;
const INVINCIBLE_DAYS = 14;

export const rankingBadges: BadgeSpec[] = [
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
    description: "Vous êtes 1er du classement avec au moins 10 points d'avance sur le 2e.",
    condition: "Être 1er du classement avec au moins 10 points d'avance sur le 2e",
    category: "RANKING",
    rarity: "EPIC",
    icon: "👊",
    evaluate: (ctx) =>
      ctx.currentRank === 1 && ctx.gapToSecondPts !== null && ctx.gapToSecondPts >= DOMINATION_MIN_GAP_PTS,
  },
  {
    code: "INVINCIBLE",
    name: "Invincible",
    description: "Vous êtes resté(e) en tête du classement 14 jours consécutifs.",
    condition: "Rester en tête du classement 14 jours consécutifs",
    category: "RANKING",
    rarity: "LEGENDARY",
    icon: "🛡️",
    evaluate: (ctx) => {
      if (ctx.rankHistory.length < INVINCIBLE_DAYS) return false;
      return ctx.rankHistory.slice(0, INVINCIBLE_DAYS).every((point) => point.rank === 1);
    },
  },
];

/**
 * Close-only : "avoir été dernier PUIS terminer sur le podium final" ne peut être confirmé
 * qu'à la clôture (le classement final n'est définitif qu'à ce moment) — voir
 * award-close-only-badges.ts.
 */
export const LE_PHENIX: BadgeSpec = {
  code: "LE_PHENIX",
  name: "Le Phénix",
  description: "Vous avez été dernier du classement à un moment donné, puis avez terminé sur le podium final.",
  condition: "Avoir été dernier à un moment donné puis terminer sur le podium (Top 3) final",
  category: "RANKING",
  rarity: "LEGENDARY",
  icon: "🔥",
};
