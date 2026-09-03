import type { BadgeSpec } from "./types";

const HABITUE_STREAK_DAYS = 10;

export const specialEventBadges: BadgeSpec[] = [
  {
    code: "LEVE_TOT",
    name: "Lève-tôt",
    description: "Vous avez été le tout premier participant du concours à finaliser votre portefeuille.",
    condition: "Être le 1er participant du concours à finaliser son portefeuille (badge exclusif, un seul gagnant)",
    category: "SPECIAL_EVENT",
    rarity: "RARE",
    icon: "🐓",
    awardableDuringInit: true,
    // L'exclusivité (« le 1er ») est vérifiée à l'attribution dans evaluate-badges.ts
    // (état DB, pas dérivable du seul contexte). Ici : condition individuelle (portefeuille complet).
    evaluate: (ctx) => ctx.maxPositions > 0 && ctx.openPositionCount >= ctx.maxPositions,
  },
  {
    code: "ZEN",
    name: "Zen",
    description: "Vous avez laissé passer une semaine complète sans aucun changement alors qu'une fenêtre était ouverte.",
    condition: "Ne réaliser aucun changement pendant une semaine alors qu'une fenêtre était disponible",
    category: "SPECIAL_EVENT",
    rarity: "COMMON",
    icon: "🧘",
    evaluate: (ctx) => ctx.weeklyChangeWindows.some((week) => week.hadWindow && week.changesUsed === 0),
  },
  {
    code: "STRATEGE_ASSIDU",
    name: "Stratège assidu",
    description: "Vous avez participé à chaque session de changement du concours.",
    condition: "Avoir utilisé sa fenêtre de changement chaque semaine du concours",
    category: "SPECIAL_EVENT",
    rarity: "EPIC",
    icon: "📋",
  },
  {
    code: "HABITUE",
    name: "Habitué",
    description: "Vous vous êtes connecté(e) 10 jours d'affilée.",
    condition: "Se connecter 10 jours consécutifs",
    category: "SPECIAL_EVENT",
    rarity: "COMMON",
    icon: "📆",
    // Assiduité de connexion, sans rapport avec la phase de constitution.
    awardableDuringInit: true,
    evaluate: (ctx) => ctx.currentStreakDays >= HABITUE_STREAK_DAYS || ctx.longestStreakDays >= HABITUE_STREAK_DAYS,
  },
];
