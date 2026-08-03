import { TransactionType } from "@/generated/prisma/enums";

export interface PositionForMatching {
  id: string;
  assetId: string;
  avgEntryPrice: number;
  /** Quantité actuelle de la position — 0 pour une position clôturée (voir execute-order.ts SELL_FULL). */
  quantity: number;
  openedAt: Date;
  closedAt: Date | null;
}

export interface TransactionForMatching {
  assetId: string;
  type: TransactionType;
  price: number;
  /** Quantité vendue par cette transaction — seule source fiable pour une position déjà remise à 0. */
  quantity: number;
  createdAt: Date;
}

export interface Trade {
  positionId: string;
  assetId: string;
  /** Valeur investie (open) ou investie à l'achat (closed), utilisée comme base du calcul de gain. */
  costBasisEur: number;
  /** Valeur actuelle (open, prix fourni par l'appelant) ou valeur de sortie (closed). */
  exitValueEur: number;
  pnlEur: number;
  pnlPct: number;
  isOpen: boolean;
}

/**
 * Associe chaque position clôturée à sa transaction SELL_FULL de sortie, en
 * appariant en FIFO par actif (les positions sur un même actif sont
 * nécessairement séquentielles — un seul portefeuille ne peut avoir deux
 * positions ouvertes simultanées sur le même actif, voir execute-order.ts).
 * Les positions ouvertes reçoivent leur P&L latent à partir de
 * `currentPricesByAsset`.
 */
export function buildTrades(
  positions: PositionForMatching[],
  transactions: TransactionForMatching[],
  currentPricesByAsset: Map<string, number>,
): Trade[] {
  const sellsByAsset = new Map<string, TransactionForMatching[]>();
  for (const transaction of transactions) {
    if (transaction.type !== TransactionType.SELL_FULL) continue;
    const list = sellsByAsset.get(transaction.assetId) ?? [];
    list.push(transaction);
    sellsByAsset.set(transaction.assetId, list);
  }
  for (const list of sellsByAsset.values()) list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const cursorByAsset = new Map<string, number>();
  const positionsByAssetSorted = [...positions].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());

  const trades: Trade[] = [];
  for (const position of positionsByAssetSorted) {
    if (position.closedAt) {
      const cursor = cursorByAsset.get(position.assetId) ?? 0;
      const sell = sellsByAsset.get(position.assetId)?.[cursor];
      cursorByAsset.set(position.assetId, cursor + 1);
      if (!sell) continue;

      const costBasisEur = position.avgEntryPrice * sell.quantity;
      const exitValueEur = sell.price * sell.quantity;
      const pnlEur = exitValueEur - costBasisEur;
      trades.push({
        positionId: position.id,
        assetId: position.assetId,
        costBasisEur,
        exitValueEur,
        pnlEur,
        pnlPct: costBasisEur > 0 ? (pnlEur / costBasisEur) * 100 : 0,
        isOpen: false,
      });
    } else {
      const currentPrice = currentPricesByAsset.get(position.assetId) ?? position.avgEntryPrice;
      const costBasisEur = position.avgEntryPrice * position.quantity;
      const exitValueEur = currentPrice * position.quantity;
      const pnlEur = exitValueEur - costBasisEur;
      trades.push({
        positionId: position.id,
        assetId: position.assetId,
        costBasisEur,
        exitValueEur,
        pnlEur,
        pnlPct: costBasisEur > 0 ? (pnlEur / costBasisEur) * 100 : 0,
        isOpen: true,
      });
    }
  }

  return trades;
}
