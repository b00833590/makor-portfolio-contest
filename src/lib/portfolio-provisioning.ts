import "server-only";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";

/**
 * Crée un Portfolio pour chaque participant déjà assigné à la promotion et qui
 * n'en a pas encore un. Idempotent (skipDuplicates) — peut être rappelé sans
 * risque si des participants sont ajoutés après l'activation.
 */
export async function provisionPortfolios(promotionId: string): Promise<number> {
  const participants = await db.user.findMany({
    where: { promotionId },
    select: { id: true },
  });

  const result = await db.portfolio.createMany({
    data: participants.map((participant) => ({ userId: participant.id, promotionId })),
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * À appeler après toute création/réaffectation de participant : une
 * promotion DRAFT n'a besoin de rien (le portefeuille est provisionné à
 * l'activation), mais un participant ajouté ou réaffecté vers une promotion
 * déjà ACTIVE n'obtenait jusqu'ici jamais de Portfolio — son tableau de bord
 * restait bloqué sur "aucun portefeuille" sans qu'aucune erreur ne le
 * signale à l'admin. `provisionPortfolios` étant idempotent, l'appeler ici
 * ne recrée rien pour les participants déjà pourvus.
 */
export async function provisionPortfolioIfPromotionActive(promotionId: string): Promise<void> {
  const promotion = await db.promotion.findUnique({ where: { id: promotionId }, select: { status: true } });
  if (promotion?.status === PromotionStatus.ACTIVE) {
    await provisionPortfolios(promotionId);
  }
}
