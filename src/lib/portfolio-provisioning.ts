import "server-only";
import { db } from "@/lib/db";

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
