import type { BadgeSpec } from "./types";

/**
 * Distinctions de fin de concours — toutes close-only : calculées une seule fois à la clôture
 * de la promotion, sur l'ensemble des participants (voir award-close-only-badges.ts). Aucune
 * n'a de fonction `evaluate` : elles ne sont jamais évaluées dans la boucle standard.
 */
export const distinctionBadges: BadgeSpec[] = [
  {
    code: "CHAMPION_DU_CONCOURS",
    name: "Champion du concours",
    description: "Vous avez terminé 1er du classement final.",
    condition: "Terminer 1er du classement final",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🏆",
  },
  {
    code: "MEILLEUR_STOCK_PICKER",
    name: "Meilleur stock picker",
    description: "Vous avez réalisé le trade avec le meilleur gain % de tout le concours.",
    condition: "Réaliser le trade avec le meilleur gain % de tout le concours",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🎯",
  },
  {
    code: "MEILLEUR_TRADER",
    name: "Meilleur trader",
    description: "Vous avez le meilleur taux de réussite sur au moins 5 trades clôturés.",
    condition: "Avoir le meilleur taux de réussite sur au moins 5 trades clôturés",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "📊",
  },
  {
    code: "MEILLEUR_TIMING",
    name: "Meilleur timing",
    description: "Vous avez réalisé le meilleur achat juste avant une hausse de tout le concours.",
    condition: "Réaliser le meilleur achat juste avant une hausse (meilleure progression dans les 5 jours suivants, tous participants confondus)",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "⏱️",
  },
];
