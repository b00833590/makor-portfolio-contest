import "server-only";
import { db } from "@/lib/db";
import type { PromotionStatus } from "@/generated/prisma/enums";

export interface ParticipantPromotion {
  id: string;
  name: string;
  status: PromotionStatus;
}

/**
 * Les promotions auxquelles un participant est (ou a été) inscrit, la plus
 * récente d'abord — pilote les onglets de la page /badges.
 */
export async function getParticipantPromotions(userId: string): Promise<ParticipantPromotion[]> {
  const rows = await db.promotionParticipant.findMany({
    where: { userId },
    select: { promotion: { select: { id: true, name: true, status: true } } },
    orderBy: { promotion: { createdAt: "desc" } },
  });
  return rows.map((row) => row.promotion);
}
