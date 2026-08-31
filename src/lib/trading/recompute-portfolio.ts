import "server-only";
import { db } from "@/lib/db";
import { replayPositions } from "./replay-positions";

/**
 * Reconstruit entièrement les positions d'un portefeuille en rejouant tout
 * son historique de transactions (voir {@link replayPositions}) — la
 * transaction reste la seule source de vérité ; les positions ne sont
 * jamais éditées directement, seulement recalculées à partir d'elle.
 *
 * Appelée automatiquement après tout ajout/modification/suppression d'une
 * transaction par l'admin, pour que le portefeuille ne puisse jamais dériver
 * de son historique (voir docs/ADMINISTRATION.md).
 */
export async function recomputePortfolioPositions(portfolioId: string): Promise<void> {
  const transactions = await db.transaction.findMany({
    where: { portfolioId },
    orderBy: { createdAt: "asc" },
  });

  const rebuilt = replayPositions(transactions);

  await db.$transaction(async (tx) => {
    await tx.position.deleteMany({ where: { portfolioId } });
    if (rebuilt.length > 0) {
      await tx.position.createMany({
        data: rebuilt.map((position) => ({
          portfolioId,
          assetId: position.assetId,
          quantity: position.quantity,
          avgEntryPrice: position.avgEntryPrice,
          openedAt: position.openedAt,
          closedAt: position.closedAt,
        })),
      });
    }
  });
}
