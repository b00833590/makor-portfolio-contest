import type { BadgeCategory, BadgeRarity } from "@/generated/prisma/enums";

export const RARITY_LABEL: Record<BadgeRarity, string> = {
  COMMON: "Commun",
  RARE: "Rare",
  EPIC: "Épique",
  LEGENDARY: "Légendaire",
};

/** Palette de raretés façon jeu vidéo (commun neutre → légendaire doré) — Tailwind pur, aucun
 * nouveau token de design nécessaire. */
export const RARITY_CLASSNAME: Record<BadgeRarity, string> = {
  COMMON: "border-border/60 bg-muted/50 text-muted-foreground",
  RARE: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  EPIC: "border-violet-500/30 bg-violet-500/10 text-violet-500",
  LEGENDARY: "border-amber-500/30 bg-amber-500/10 text-amber-500",
};

export const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  PERFORMANCE: "Performance",
  TRADING: "Trading",
  RISK_MANAGEMENT: "Gestion du risque",
  CONVICTION: "Convictions",
  DIVERSIFICATION: "Diversification",
  RANKING: "Classement",
  SPECIAL_EVENT: "Événements spéciaux",
  DISTINCTION: "Distinctions",
};
