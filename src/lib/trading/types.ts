import type { AssetType, ChangeSessionStatus, PromotionStatus } from "@/generated/prisma/enums";
import type { PromotionRules } from "@/lib/promotion-rules";

export type TradeOrderInput =
  | { type: "BUY"; assetId: string; amount: number }
  | { type: "INCREASE"; assetId: string; amount: number }
  | { type: "SELL_PARTIAL"; assetId: string; quantity: number }
  | { type: "SELL_FULL"; assetId: string };

export interface PositionContext {
  assetId: string;
  assetType: AssetType;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
}

export interface TradeContext {
  now: Date;
  promotion: {
    status: PromotionStatus;
    endDate: Date;
    rules: PromotionRules;
  };
  /** La session de changement actuellement ouverte pour cette date, ou null s'il n'y en a aucune. */
  changeSession: {
    status: ChangeSessionStatus;
    opensAt: Date;
    closesAt: Date;
    maxChangesPerParticipant: number;
  } | null;
  /** Nombre de changements déjà utilisés par le participant sur cette session. */
  changesUsed: number;
  /** Capital non investi, calculé à partir du grand livre des transactions. */
  availableCash: number;
  /** Positions ouvertes actuelles du portefeuille (l'actif ciblé peut ne pas y figurer). */
  positions: PositionContext[];
  asset: {
    id: string;
    type: AssetType;
    isActive: boolean;
    currentPrice: number;
  };
}

export type TradeValidationResult = { ok: true } | { ok: false; reason: string };
