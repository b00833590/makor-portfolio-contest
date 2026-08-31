import type { Prisma } from "@/generated/prisma/client";
import { TransactionType } from "@/generated/prisma/enums";

export interface ReplayTransaction {
  assetId: string;
  type: TransactionType;
  quantity: Prisma.Decimal | number;
  price: Prisma.Decimal | number;
  createdAt: Date;
}

export interface ReplayedPosition {
  assetId: string;
  quantity: number;
  avgEntryPrice: number;
  openedAt: Date;
  closedAt: Date | null;
}

/**
 * Rejoue l'historique de transactions d'un portefeuille (ordre chronologique)
 * et en dérive la liste complète de ses positions — lignes clôturées incluses
 * (quantity 0, closedAt renseigné). La transaction est la seule source de
 * vérité ; les positions n'en sont qu'une projection.
 *
 * Fonction pure (pas d'I/O, pas de `server-only`) pour être rejouable aussi
 * bien par {@link recomputePortfolioPositions} que par un script de
 * maintenance hors runtime Next.
 *
 * Les lignes clôturées sont conservées parce que `buildTrades` /
 * `match-closing-trades` en ont besoin pour reconstruire les trades réalisés
 * (win rate, meilleur trade, gain moyen) — le flux de trading normal les écrit
 * (SELL_FULL renseigne `closedAt`), ce rejeu doit donc en faire autant.
 */
export function replayPositions(transactions: ReplayTransaction[]): ReplayedPosition[] {
  // Au plus une position ouverte par actif (contrainte d'unicité partielle en
  // base) + toutes les lignes déjà clôturées, dans l'ordre où elles se ferment.
  const openByAsset = new Map<string, ReplayedPosition>();
  const closed: ReplayedPosition[] = [];

  const close = (position: ReplayedPosition, at: Date) => {
    closed.push({ ...position, quantity: 0, closedAt: at });
    openByAsset.delete(position.assetId);
  };

  for (const transaction of transactions) {
    const quantity = Number(transaction.quantity);
    const price = Number(transaction.price);
    const existing = openByAsset.get(transaction.assetId);

    switch (transaction.type) {
      case TransactionType.BUY:
        // Rachat après une vente totale : l'ancienne ligne est déjà dans `closed`.
        // Un BUY alors qu'une position est encore ouverte ne devrait pas arriver
        // (contrainte d'unicité) — on clôt l'ancienne par sécurité plutôt que de la perdre.
        if (existing) close(existing, transaction.createdAt);
        openByAsset.set(transaction.assetId, {
          assetId: transaction.assetId,
          quantity,
          avgEntryPrice: price,
          openedAt: transaction.createdAt,
          closedAt: null,
        });
        break;

      case TransactionType.INCREASE: {
        if (!existing) break; // historique incohérent (renforcement sans achat) — ignoré plutôt que planter
        const newQuantity = existing.quantity + quantity;
        const newAvgPrice = (existing.quantity * existing.avgEntryPrice + quantity * price) / newQuantity;
        openByAsset.set(transaction.assetId, { ...existing, quantity: newQuantity, avgEntryPrice: newAvgPrice });
        break;
      }

      case TransactionType.SELL_PARTIAL:
      case TransactionType.DECREASE: {
        if (!existing) break;
        const remaining = Math.max(0, existing.quantity - quantity);
        if (remaining === 0) {
          close(existing, transaction.createdAt);
        } else {
          openByAsset.set(transaction.assetId, { ...existing, quantity: remaining });
        }
        break;
      }

      case TransactionType.SELL_FULL:
        if (!existing) break;
        close(existing, transaction.createdAt);
        break;
    }
  }

  return [...closed, ...openByAsset.values()];
}
