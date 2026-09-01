import { TransactionType } from "@/generated/prisma/enums";
import type { BadgeSpec } from "./types";

const MAIN_CHAUDE_STREAK = 4;
const BEAU_MOVE_GAIN_PCT = 12;
const GROS_COUP_GAIN_PCT = 25;
const LE_BON_INSTINCT_GAIN_PCT = 15;

/** Vrai s'il existe `count` trades clôturés gagnants consécutifs quelque part dans la série
 * chronologique (pas seulement les `count` derniers). */
export function hasWinningStreak(trades: { pnlEur: number }[], count: number): boolean {
  let run = 0;
  for (const trade of trades) {
    run = trade.pnlEur >= 0 ? run + 1 : 0;
    if (run >= count) return true;
  }
  return false;
}

export interface ArbitrageTransaction {
  type: (typeof TransactionType)[keyof typeof TransactionType];
  assetId: string;
  changeSessionId: string | null;
}

/**
 * Un arbitrage réussi : dans une même session de changement, une vente et un achat d'un actif
 * DIFFÉRENT, où l'actif racheté est aujourd'hui en position gagnante. `currentPnlPctByAsset` ne
 * couvre que les positions actuellement ouvertes — un actif racheté puis déjà revendu ne compte
 * plus (pas de "gain" à mesurer sans position ouverte).
 */
export function computeHasSuccessfulArbitrage(
  transactions: ArbitrageTransaction[],
  currentPnlPctByAsset: Map<string, number>,
): boolean {
  const bySession = new Map<string, ArbitrageTransaction[]>();
  for (const transaction of transactions) {
    if (!transaction.changeSessionId) continue;
    const list = bySession.get(transaction.changeSessionId) ?? [];
    list.push(transaction);
    bySession.set(transaction.changeSessionId, list);
  }

  for (const sessionTransactions of bySession.values()) {
    const soldAssetIds = new Set(
      sessionTransactions
        .filter((t) => t.type === TransactionType.SELL_FULL || t.type === TransactionType.SELL_PARTIAL)
        .map((t) => t.assetId),
    );
    if (soldAssetIds.size === 0) continue;

    const boughtDifferentAsset = sessionTransactions.some(
      (t) => t.type === TransactionType.BUY && !soldAssetIds.has(t.assetId),
    );
    if (!boughtDifferentAsset) continue;

    const isAnyWinning = sessionTransactions.some((t) => {
      if (t.type !== TransactionType.BUY || soldAssetIds.has(t.assetId)) return false;
      return (currentPnlPctByAsset.get(t.assetId) ?? -Infinity) >= 0;
    });
    if (isAnyWinning) return true;
  }

  return false;
}

export const tradingBadges: BadgeSpec[] = [
  {
    code: "PREMIER_PAS",
    name: "Premier pas",
    description: "Vous avez réalisé votre première transaction.",
    condition: "Réaliser sa première transaction",
    category: "TRADING",
    rarity: "COMMON",
    icon: "🐣",
    evaluate: (ctx) => ctx.transactionCount >= 1,
  },
  {
    code: "PREMIERE_VICTOIRE",
    name: "Première prise",
    description: "Vous avez réalisé votre première vente gagnante.",
    condition: "Réaliser sa première vente gagnante",
    category: "TRADING",
    rarity: "COMMON",
    icon: "✅",
    evaluate: (ctx) => ctx.closedTradesChronological.some((trade) => trade.pnlEur >= 0),
  },
  {
    code: "BEAU_MOVE",
    name: "Beau move",
    description: "Vous avez réalisé une vente avec plus de 12% de gain.",
    condition: "Réaliser une vente avec au moins +12% de gain",
    category: "TRADING",
    rarity: "RARE",
    icon: "💰",
    evaluate: (ctx) => ctx.closedTradesChronological.some((trade) => trade.pnlPct >= BEAU_MOVE_GAIN_PCT),
  },
  {
    code: "GROS_COUP",
    name: "Gros coup",
    description: "Vous avez réalisé une vente avec plus de 25% de gain.",
    condition: "Réaliser une vente avec au moins +25% de gain",
    category: "TRADING",
    rarity: "EPIC",
    icon: "🎆",
    evaluate: (ctx) => ctx.closedTradesChronological.some((trade) => trade.pnlPct >= GROS_COUP_GAIN_PCT),
  },
  {
    code: "MAIN_CHAUDE",
    name: "Main chaude",
    description: "Vous avez enchaîné 4 ventes gagnantes consécutives.",
    condition: "Enchaîner 4 ventes gagnantes consécutives",
    category: "TRADING",
    rarity: "EPIC",
    icon: "🔥",
    evaluate: (ctx) => hasWinningStreak(ctx.closedTradesChronological, MAIN_CHAUDE_STREAK),
  },
  {
    code: "ARBITRAGISTE",
    name: "Arbitragiste",
    description: "Vous avez vendu une position puis racheté une autre, aujourd'hui gagnante, dans la même session de changement.",
    condition: "Vendre une position puis en racheter une autre gagnante dans la même session de changement",
    category: "TRADING",
    rarity: "RARE",
    icon: "🔁",
    evaluate: (ctx) => ctx.hasSuccessfulArbitrage,
  },
  {
    code: "LE_BON_INSTINCT",
    name: "Le bon instinct",
    description: "Vous avez acheté un actif juste avant une hausse d'au moins 15% dans les 5 jours suivants.",
    condition: "Acheter un actif qui prend au moins +15% dans les 5 jours suivant l'achat",
    category: "TRADING",
    rarity: "EPIC",
    icon: "🔮",
    evaluate: (ctx) => ctx.postBuyMaxGainPct !== null && ctx.postBuyMaxGainPct >= LE_BON_INSTINCT_GAIN_PCT,
  },
];
