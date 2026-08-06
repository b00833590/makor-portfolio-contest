import type { BadgeSpec } from "./types";

export const specialEventBadges: BadgeSpec[] = [
  {
    code: "PIONNIER",
    name: "Pionnier",
    description: "Vous avez été le premier participant du concours à finaliser votre portefeuille.",
    condition: "Être le 1er participant du concours à finaliser son portefeuille (badge exclusif, un seul gagnant)",
    category: "SPECIAL_EVENT",
    rarity: "RARE",
    icon: "🏕️",
    // L'exclusivité ("le 1er") est vérifiée au moment de l'attribution dans
    // evaluate-badges.ts (état DB, pas dérivable du seul contexte de cet utilisateur) — ici on
    // ne vérifie que la condition individuelle (portefeuille complet).
    evaluate: (ctx) => ctx.maxPositions > 0 && ctx.openPositionCount >= ctx.maxPositions,
  },
  {
    code: "PATIENCE_DE_FER",
    name: "Patience de fer",
    description: "Vous n'avez réalisé aucun changement pendant une semaine complète alors qu'une fenêtre était disponible.",
    condition: "Ne réaliser aucun changement pendant une semaine alors qu'une fenêtre était disponible",
    category: "SPECIAL_EVENT",
    rarity: "COMMON",
    icon: "🧘",
    evaluate: (ctx) => ctx.weeklyChangeWindows.some((week) => week.hadWindow && week.changesUsed === 0),
  },
  {
    code: "PERFECTION",
    name: "Perfection",
    description: "Vous avez obtenu tous les autres badges de la collection.",
    condition: "Obtenir tous les autres badges de la collection",
    category: "SPECIAL_EVENT",
    rarity: "LEGENDARY",
    icon: "💎",
    evaluate: (ctx) => ctx.alreadyOwnedCodes.size >= ctx.totalBadgeCount - 1,
  },
];

/**
 * Close-only : "avoir utilisé sa fenêtre de changement CHAQUE semaine du concours" ne peut être
 * confirmé qu'à la clôture (une semaine future pourrait encore être manquée) — voir
 * award-close-only-badges.ts.
 */
export const STRATEGE_ASSIDU: BadgeSpec = {
  code: "STRATEGE_ASSIDU",
  name: "Stratège assidu",
  description: "Vous avez utilisé votre fenêtre de changement chaque semaine du concours.",
  condition: "Avoir utilisé sa fenêtre de changement chaque semaine du concours",
  category: "SPECIAL_EVENT",
  rarity: "EPIC",
  icon: "📋",
};
