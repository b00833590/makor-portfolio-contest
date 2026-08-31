import type { BadgeCategory, BadgeRarity } from "@/generated/prisma/enums";

export const RARITY_LABEL: Record<BadgeRarity, string> = {
  COMMON: "Commun",
  RARE: "Rare",
  EPIC: "Épique",
  LEGENDARY: "Légendaire",
};

export const RARITY_ORDER: BadgeRarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

/** Palette de raretés façon jeu vidéo (commun neutre → légendaire doré) — Tailwind pur. */
export const RARITY_CLASSNAME: Record<BadgeRarity, string> = {
  COMMON: "border-border/60 bg-muted/50 text-muted-foreground",
  RARE: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  EPIC: "border-violet-500/30 bg-violet-500/10 text-violet-500",
  LEGENDARY: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

/** Classe de liseré appliquée à la carte d'un badge débloqué, selon sa rareté. */
export const RARITY_CARD_ACCENT: Record<BadgeRarity, string> = {
  COMMON: "border-border",
  RARE: "border-blue-500/50",
  EPIC: "border-violet-500/50",
  LEGENDARY: "border-amber-500/60 shadow-[0_0_16px_-4px_var(--color-amber-500)]",
};

/** Largeur du segment de rareté dans la barre de progression de l'en-tête. */
export const RARITY_BAR_CLASSNAME: Record<BadgeRarity, string> = {
  COMMON: "bg-muted-foreground/40",
  RARE: "bg-blue-500",
  EPIC: "bg-violet-500",
  LEGENDARY: "bg-amber-500",
};

export const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  PERFORMANCE: "Performance",
  RANKING: "Compétition",
  TRADING: "Trading",
  RISK_MANAGEMENT: "Sang-froid",
  DIVERSIFICATION: "Diversification",
  DISTINCTION: "Exploits",
  SPECIAL_EVENT: "Fun",
  CONVICTION: "Convictions",
};

export const CATEGORY_ICON: Record<BadgeCategory, string> = {
  PERFORMANCE: "📈",
  RANKING: "🏆",
  TRADING: "🎯",
  RISK_MANAGEMENT: "🛡️",
  DIVERSIFICATION: "🌍",
  DISTINCTION: "🔥",
  SPECIAL_EVENT: "😄",
  CONVICTION: "💡",
};

/** Ordre d'affichage des catégories dans l'onglet Badges. `CONVICTION` (vide) exclue. */
export const CATEGORY_ORDER: BadgeCategory[] = [
  "PERFORMANCE",
  "RANKING",
  "TRADING",
  "RISK_MANAGEMENT",
  "DIVERSIFICATION",
  "DISTINCTION",
  "SPECIAL_EVENT",
];
