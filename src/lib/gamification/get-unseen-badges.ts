import "server-only";
import { db } from "@/lib/db";
import type { BadgeRarity } from "@/generated/prisma/enums";

export interface UnseenBadge {
  code: string;
  name: string;
  rarity: BadgeRarity;
  icon: string;
  description: string;
}

/** Badges attribués mais jamais encore affichés à l'utilisateur (voir UserBadge.seenAt) — ce sont
 * nécessairement des badges obtenus via le cron nocturne : le chemin instantané (action de
 * trading) marque `seenAt` dans la même requête, voir evaluateUserBadgesForUser. */
export async function getUnseenBadges(userId: string, promotionId: string): Promise<UnseenBadge[]> {
  const unseen = await db.userBadge.findMany({
    where: { userId, promotionId, seenAt: null },
    include: { badge: { select: { code: true, name: true, rarity: true, icon: true, description: true } } },
    orderBy: { awardedAt: "asc" },
  });

  return unseen.map((userBadge) => ({
    code: userBadge.badge.code,
    name: userBadge.badge.name,
    rarity: userBadge.badge.rarity,
    icon: userBadge.badge.icon,
    description: userBadge.badge.description,
  }));
}
