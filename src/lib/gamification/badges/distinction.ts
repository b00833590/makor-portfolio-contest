import type { BadgeSpec } from "./types";

const INTOUCHABLE_CUMULATIVE_DAYS = 12;

/**
 * Distinctions & hauts faits. Les superlatifs (`CHAMPION_DU_CONCOURS`,
 * `MEILLEUR_*`, `OEIL_DE_LYNX`) et les conditions « tout le concours »
 * (`FIDELE_AU_POSTE`, `SANS_FAUTE`, `LE_PHENIX`) sont **close-only** : aucun
 * `evaluate`, calculés une seule fois à la clôture (voir award-close-only-badges.ts).
 * `INTOUCHABLE` et `PERFECTION` sont évalués en continu — leur condition est
 * monotone (ne peut que devenir vraie), donc aucun risque de faux positif.
 */
export const distinctionBadges: BadgeSpec[] = [
  {
    code: "INTOUCHABLE",
    name: "Intouchable",
    description: "Vous avez occupé la 1ère place du classement pendant 12 journées au total.",
    condition: "Être 1er du classement pendant 12 journées cumulées",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🛡️",
    evaluate: (ctx) => ctx.rankHistory.filter((point) => point.rank === 1).length >= INTOUCHABLE_CUMULATIVE_DAYS,
  },
  {
    code: "PERFECTION",
    name: "Perfection",
    description: "Vous avez débloqué tous les autres badges de la collection.",
    condition: "Débloquer tous les autres badges de la collection",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "💎",
    evaluate: (ctx) => ctx.alreadyOwnedCodes.size >= ctx.totalBadgeCount - 1,
  },
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
    code: "LE_PHENIX",
    name: "Le Phénix",
    description: "Vous avez été dernier du classement à un moment donné, puis avez terminé sur le podium final.",
    condition: "Avoir été dernier à un moment donné puis terminer sur le podium (Top 3) final",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🔥",
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
    code: "MEILLEUR_TACTICIEN",
    name: "Meilleur tacticien",
    description: "Vous avez le meilleur taux de réussite sur au moins 5 trades clôturés.",
    condition: "Avoir le meilleur taux de réussite sur au moins 5 trades clôturés",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "📊",
  },
  {
    code: "OEIL_DE_LYNX",
    name: "Œil de lynx",
    description: "Vous avez réalisé le meilleur achat juste avant une hausse de tout le concours.",
    condition: "Réaliser le meilleur achat juste avant une hausse (meilleure progression dans les 5 jours suivants, tous participants confondus)",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "👁️",
  },
  {
    code: "FIDELE_AU_POSTE",
    name: "Fidèle au poste",
    description: "Vous avez conservé une position ouverte du tout début à la toute fin du concours.",
    condition: "Conserver une position ouverte du début à la fin du concours",
    category: "DISTINCTION",
    rarity: "EPIC",
    icon: "⚓",
  },
  {
    code: "SANS_FAUTE",
    name: "Sans faute",
    description: "Aucune de vos positions n'a jamais dépassé -10% de perte, du début à la fin du concours.",
    condition: "Terminer le concours sans qu'aucune position n'ait jamais dépassé -10% de perte",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🦾",
  },
];
