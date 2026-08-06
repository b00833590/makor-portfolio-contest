import type { BadgeCategory, BadgeRarity } from "@/generated/prisma/enums";
import type { AllocationSlice } from "../get-participant-stats";

export interface BadgePositionSnapshot {
  marketValue: number;
  costBasis: number;
}

/** Trade clôturé, restreint aux champs utiles à l'évaluation de badges, trié chronologiquement. */
export interface ClosedTradeChrono {
  pnlEur: number;
  pnlPct: number;
  closedAt: Date;
}

/** Une fenêtre de changement hebdomadaire entièrement écoulée (status CLOSED) — les fenêtres
 * encore ouvertes sont exclues pour ne jamais attribuer un badge sur une semaine en cours. */
export interface ChangeWindowUsage {
  hadWindow: boolean;
  changesUsed: number;
}

export interface RankHistoryPoint {
  timestamp: Date;
  rank: number | null;
}

export interface BadgeEvaluationContext {
  now: Date;
  openPositionCount: number;
  maxPositions: number;
  investedValue: number;
  positions: BadgePositionSnapshot[];
  transactionCount: number;
  firstTransactionDate: Date | null;
  lastTransactionDate: Date | null;
  closedTradesChronological: ClosedTradeChrono[];
  hasSuccessfulArbitrage: boolean;
  /** Meilleur gain % atteint dans les 5 jours suivant un achat, tous achats confondus ; `null` si aucun achat. */
  postBuyMaxGainPct: number | null;
  cumulativeReturnPct: number;
  dailyReturnPct: number | null;
  currentRank: number | null;
  previousRank: number | null;
  /** Écart en points de % entre le 1er et le 2e du classement ; `null` si non pertinent (pas 1er). */
  gapToSecondPts: number | null;
  /** Le plus récent en premier. */
  rankHistory: RankHistoryPoint[];
  participantCount: number;
  sectorAllocation: AllocationSlice[];
  currencyAllocation: AllocationSlice[];
  weeklyChangeWindows: ChangeWindowUsage[];
  currentStreakDays: number;
  longestStreakDays: number;
  /** Codes déjà obtenus par l'utilisateur (avant cette évaluation) — pour le méta-badge PERFECTION. */
  alreadyOwnedCodes: Set<string>;
  /** Nombre total de badges du catalogue — pour le méta-badge PERFECTION. */
  totalBadgeCount: number;
}

export interface BadgeSpec {
  code: string;
  name: string;
  description: string;
  condition: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  icon: string;
  /**
   * Absent uniquement pour les badges "close-only" (voir CLOSE_ONLY_CODES dans catalog.ts) :
   * des superlatifs qui ne peuvent être déterminés qu'une fois le concours terminé (ex. "meilleur
   * trade du concours") et qui, comme UserBadge ne peut jamais être retiré, ne doivent jamais être
   * évalués progressivement au risque d'être attribués à tort avant la fin.
   */
  evaluate?: (ctx: BadgeEvaluationContext) => boolean;
}
