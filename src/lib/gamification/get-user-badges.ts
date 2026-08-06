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

export async function getUserBadges(userId: string, promotionId: string): Promise<EarnedBadge[]> {
  const userBadges = await db.userBadge.findMany({
    where: { userId, promotionId },
    include: { badge: true },
    orderBy: { awardedAt: "desc" },
  });

  return userBadges.map((userBadge) => ({
    code: userBadge.badge.code,
    name: userBadge.badge.name,
    description: userBadge.badge.description,
    condition: userBadge.badge.condition,
    category: userBadge.badge.category,
    rarity: userBadge.badge.rarity,
    icon: userBadge.badge.icon,
    awardedAt: userBadge.awardedAt,
  }));
}
