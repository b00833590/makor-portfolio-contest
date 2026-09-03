import type { BadgeCategory, BadgeRarity } from "@/generated/prisma/enums";

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
  weeklyChangeWindows: ChangeWindowUsage[];
  currentStreakDays: number;
  longestStreakDays: number;
  /** Moyenne de `cumulativeReturnPct` sur tous les participants du classement. */
  fieldAverageReturnPct: number;
  /** Ce participant a le meilleur rendement 7 jours glissants de tous les participants, sa semaine
   * est strictement positive, et au moins 3 participants ont une valeur hebdomadaire. */
  hasBestWeeklyReturn: boolean;
  /** Nombre d'actifs distincts jamais tradés (transactions), ouverts ou non. */
  distinctAssetsTradedCount: number;
  /** Détient au moins une action ET au moins une crypto en position ouverte. */
  holdsStockAndCrypto: boolean;
  /** Poids (%) de la plus grosse position ouverte dans la valeur investie ; `null` si aucune position. */
  maxPositionConcentrationPct: number | null;
  /** Existe une position ouverte : âge >= 21 j, P&L latent >= +10%, jamais renforcée ni allégée. */
  hasAnchorPosition: boolean;
  /** A été 1er, l'a perdu au moins un snapshot, et est 1er à nouveau maintenant. */
  regainedFirstPlace: boolean;
  /** Codes déjà obtenus par l'utilisateur (avant cette évaluation) — pour le méta-badge PERFECTION. */
  alreadyOwnedCodes: Set<string>;
  /** Nombre total de badges du catalogue. */
  totalBadgeCount: number;
  /** Nombre de badges gagnables en cours de concours (catalogue moins les close-only) — pour PERFECTION. */
  evaluatableBadgeCount: number;
  /** La fenêtre de constitution du portefeuille de la promotion est terminée (ou n'existe pas).
   * Tant qu'elle est ouverte, seuls les badges `awardableDuringInit` sont attribués — un badge
   * comme « Sur le toit » n'a aucun sens quand le concours vient de démarrer. */
  initWindowClosed: boolean;
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
  /**
   * Attribuable même pendant la fenêtre de constitution du portefeuille. Par défaut (absent) un
   * badge n'est attribué qu'une fois cette fenêtre terminée. À réserver aux badges qui portent
   * précisément sur la phase de constitution (première transaction, portefeuille complété…).
   */
  awardableDuringInit?: boolean;
}
