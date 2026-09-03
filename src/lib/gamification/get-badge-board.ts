import "server-only";
import type { BadgeCategory, BadgeRarity } from "@/generated/prisma/enums";
import { BADGE_CATALOG } from "./badges/catalog";
import { CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_ICON, RARITY_ORDER } from "./badge-display";
import { getUserBadges, type EarnedBadge } from "./get-user-badges";
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
  /** Badge obtenu dont le code ne fait plus partie du catalogue courant (ancienne saison). */
  legacy?: boolean;
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

function legacyEntry(badge: EarnedBadge): BadgeBoardEntry {
  return {
    code: badge.code,
    name: badge.name,
    description: badge.description,
    condition: badge.condition,
    category: badge.category,
    rarity: badge.rarity,
    icon: badge.icon,
    earned: true,
    awardedAt: badge.awardedAt,
    legacy: true,
  };
}

/**
 * Construit le tableau de bord des badges.
 * - `promotionId` fourni → périmètre = badges de cette promotion.
 * - absent → collection à vie (toutes promotions, dédoublonnée).
 *
 * Les entrées viennent de BADGE_CATALOG (badges verrouillés inclus). Un badge
 * obtenu dont le code a disparu du catalogue (ancienne saison) est ajouté comme
 * entrée `legacy` à partir de sa fiche en base — il ne doit pas disparaître.
 */
export async function getBadgeBoard(userId: string, promotionId?: string): Promise<BadgeBoard> {
  const earned = await getUserBadges(userId, promotionId);
  const earnedByCode = new Map(earned.map((badge) => [badge.code, badge]));
  const catalogCodes = new Set(BADGE_CATALOG.map((spec) => spec.code));

  const catalogEntries: BadgeBoardEntry[] = BADGE_CATALOG.map((spec) => {
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

  const legacyEntries = earned
    .filter((badge) => !catalogCodes.has(badge.code))
    .map(legacyEntry);

  const entries = [...catalogEntries, ...legacyEntries];
  const earnedEntries = entries.filter((entry) => entry.earned);

  const mostRecentBadge = earnedEntries.reduce<BadgeBoardEntry | null>((latest, entry) => {
    if (!latest || !latest.awardedAt) return entry;
    if (!entry.awardedAt) return latest;
    return entry.awardedAt > latest.awardedAt ? entry : latest;
  }, null);

  const xp = computeXp(earned);
  const totalCount = BADGE_CATALOG.length;

  const byCategory: BadgeCategoryGroup[] = CATEGORY_ORDER.map((category) => {
    const catEntries = entries.filter((entry) => entry.category === category);
    return {
      category,
      label: CATEGORY_LABEL[category],
      icon: CATEGORY_ICON[category],
      earned: catEntries.filter((entry) => entry.earned).length,
      total: catEntries.filter((entry) => !entry.legacy).length,
      entries: catEntries,
    };
  }).filter((group) => group.entries.length > 0);

  const byRarity: BadgeRarityCount[] = RARITY_ORDER.map((rarity) => {
    const rarEntries = entries.filter((entry) => entry.rarity === rarity);
    return {
      rarity,
      earned: rarEntries.filter((entry) => entry.earned).length,
      total: rarEntries.filter((entry) => !entry.legacy).length,
    };
  });

  return {
    entries,
    earnedCount: earnedEntries.length,
    totalCount,
    completionPct: totalCount > 0 ? Math.min(100, (earnedEntries.length / totalCount) * 100) : 0,
    rareOwnedCount: earnedEntries.filter((entry) => RARE_RARITIES.has(entry.rarity)).length,
    mostRecentBadge,
    byCategory,
    byRarity,
    xp,
    level: computeLevel(xp),
  };
}
