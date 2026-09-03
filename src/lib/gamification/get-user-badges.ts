import "server-only";
import { db } from "@/lib/db";
import type { BadgeCategory, BadgeRarity } from "@/generated/prisma/enums";

export interface EarnedBadge {
  code: string;
  name: string;
  description: string;
  condition: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  icon: string;
  awardedAt: Date;
}

/**
 * Badges obtenus par un participant.
 * - avec `promotionId` : uniquement ceux de cette promotion.
 * - sans : collection à vie, toutes promotions confondues, dédoublonnée par code
 *   (un badge regagné n'apparaît qu'une fois, daté de sa première obtention).
 */
export async function getUserBadges(userId: string, promotionId?: string): Promise<EarnedBadge[]> {
  const userBadges = await db.userBadge.findMany({
    where: promotionId ? { userId, promotionId } : { userId },
    include: { badge: true },
    orderBy: { awardedAt: "asc" },
  });

  const firstByCode = new Map<string, EarnedBadge>();
  for (const userBadge of userBadges) {
    if (firstByCode.has(userBadge.badge.code)) continue; // asc → la 1re vue est la plus ancienne
    firstByCode.set(userBadge.badge.code, {
      code: userBadge.badge.code,
      name: userBadge.badge.name,
      description: userBadge.badge.description,
      condition: userBadge.badge.condition,
      category: userBadge.badge.category,
      rarity: userBadge.badge.rarity,
      icon: userBadge.badge.icon,
      awardedAt: userBadge.awardedAt,
    });
  }

  return [...firstByCode.values()];
}
