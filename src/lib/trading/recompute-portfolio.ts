import "server-only";
import { db } from "@/lib/db";
import { TransactionType } from "@/generated/prisma/enums";

interface ReplayedPosition {
  assetId: string;
  quantity: number;
  avgEntryPrice: number;
  openedAt: Date;
}

/**
 * Reconstruit entièrement les positions d'un portefeuille en rejouant tout
 * son historique de transactions, dans l'ordre chronologique — la
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

  const positionsByAsset = new Map<string, ReplayedPosition>();

  for (const transaction of transactions) {
    const quantity = Number(transaction.quantity);
    const price = Number(transaction.price);
    const existing = positionsByAsset.get(transaction.assetId);

    switch (transaction.type) {
      case TransactionType.BUY:
        positionsByAsset.set(transaction.assetId, {
          assetId: transaction.assetId,
          quantity,
          avgEntryPrice: price,
          openedAt: transaction.createdAt,
        });
        break;

      case TransactionType.INCREASE: {
        if (!existing) break; // historique incohérent (renforcement sans achat) — ignoré plutôt que planter
        const newQuantity = existing.quantity + quantity;
        const newAvgPrice = (existing.quantity * existing.avgEntryPrice + quantity * price) / newQuantity;
        positionsByAsset.set(transaction.assetId, { ...existing, quantity: newQuantity, avgEntryPrice: newAvgPrice });
        break;
      }

      case TransactionType.SELL_PARTIAL:
      case TransactionType.DECREASE: {
        if (!existing) break;
        positionsByAsset.set(transaction.assetId, {
          ...existing,
          quantity: Math.max(0, existing.quantity - quantity),
        });
        break;
      }

      case TransactionType.SELL_FULL:
        if (!existing) break;
        positionsByAsset.set(transaction.assetId, { ...existing, quantity: 0 });
        break;
    }
  }

  const openPositions = [...positionsByAsset.values()].filter((position) => position.quantity > 0);

  await db.$transaction(async (tx) => {
    await tx.position.deleteMany({ where: { portfolioId } });
    if (openPositions.length > 0) {
      await tx.position.createMany({
        data: openPositions.map((position) => ({
          portfolioId,
          assetId: position.assetId,
          quantity: position.quantity,
          avgEntryPrice: position.avgEntryPrice,
          openedAt: position.openedAt,
        })),
      });
    }
  });
}
