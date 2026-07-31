import "server-only";
import { db } from "@/lib/db";

export interface EarnedBadge {
  code: string;
  name: string;
  description: string;
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
    icon: userBadge.badge.icon,
    awardedAt: userBadge.awardedAt,
  }));
}
