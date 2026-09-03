import "server-only";
import type { BadgeCategory, BadgeRarity } from "@/generated/prisma/enums";
import { BADGE_CATALOG } from "./badges/catalog";
import { CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_ICON, RARITY_ORDER } from "./badge-display";
import { getUserBadges } from "./get-user-badges";
import { computeXp, computeLevel, type LevelInfo } from "./xp";

export interface BadgeBoardEntry {
  code: string;
  name: string;
  description: string;
  condition: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  icon: string;
  earned: boolean;
  awardedAt: Date | null;
}

export interface BadgeCategoryGroup {
  category: BadgeCategory;
  label: string;
  icon: string;
  earned: number;
  total: number;
  entries: BadgeBoardEntry[];
}

export interface BadgeRarityCount {
  rarity: BadgeRarity;
  earned: number;
  total: number;
}

export interface BadgeBoard {
  entries: BadgeBoardEntry[];
  earnedCount: number;
  totalCount: number;
  completionPct: number;
  rareOwnedCount: number;
  mostRecentBadge: BadgeBoardEntry | null;
  byCategory: BadgeCategoryGroup[];
  byRarity: BadgeRarityCount[];
  xp: number;
  level: LevelInfo;
}

const RARE_RARITIES = new Set<BadgeRarity>(["EPIC", "LEGENDARY"]);

/** Toujours construit à partir de BADGE_CATALOG (pas d'une requête `Badge` brute) — ne montre
 * jamais un éventuel badge orphelin d'un ancien catalogue qui ne serait plus dans le code.
 * Les badges obtenus sont cumulés sur toutes les promotions du participant (collection à vie),
 * donc XP / niveau / % de complétion sont des totaux à vie. */
export async function getBadgeBoard(userId: string): Promise<BadgeBoard> {
  const earned = await getUserBadges(userId);
  const earnedByCode = new Map(earned.map((badge) => [badge.code, badge]));

  const entries: BadgeBoardEntry[] = BADGE_CATALOG.map((spec) => {
    const earnedBadge = earnedByCode.get(spec.code);
    return {
      code: spec.code,
      name: spec.name,
      description: spec.description,
      condition: spec.condition,
      category: spec.category,
      rarity: spec.rarity,
      icon: spec.icon,
      earned: earnedBadge !== undefined,
      awardedAt: earnedBadge?.awardedAt ?? null,
    };
  });

  const earnedEntries = entries.filter((entry) => entry.earned);
  const mostRecentBadge = earnedEntries.reduce<BadgeBoardEntry | null>((latest, entry) => {
    if (!latest || !latest.awardedAt) return entry;
    if (!entry.awardedAt) return latest;
    return entry.awardedAt > latest.awardedAt ? entry : latest;
  }, null);

  const xp = computeXp(earned);

  const byCategory: BadgeCategoryGroup[] = CATEGORY_ORDER.map((category) => {
    const catEntries = entries.filter((entry) => entry.category === category);
    return {
      category,
      label: CATEGORY_LABEL[category],
      icon: CATEGORY_ICON[category],
      earned: catEntries.filter((entry) => entry.earned).length,
      total: catEntries.length,
      entries: catEntries,
    };
  }).filter((group) => group.total > 0);

  const byRarity: BadgeRarityCount[] = RARITY_ORDER.map((rarity) => {
    const rarEntries = entries.filter((entry) => entry.rarity === rarity);
    return { rarity, earned: rarEntries.filter((entry) => entry.earned).length, total: rarEntries.length };
  });

  return {
    entries,
    earnedCount: earnedEntries.length,
    totalCount: BADGE_CATALOG.length,
    completionPct: BADGE_CATALOG.length > 0 ? (earnedEntries.length / BADGE_CATALOG.length) * 100 : 0,
    rareOwnedCount: earnedEntries.filter((entry) => RARE_RARITIES.has(entry.rarity)).length,
    mostRecentBadge,
    byCategory,
    byRarity,
    xp,
    level: computeLevel(xp),
  };
}
