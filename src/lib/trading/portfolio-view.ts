import "server-only";
import { db } from "@/lib/db";
import type { AssetType, PromotionStatus } from "@/generated/prisma/enums";
import { computeAvailableCash } from "./execute-order";

export interface PositionView {
  assetId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  pnl: number;
  pnlPct: number;
}

export interface PortfolioView {
  promotionId: string;
  promotionName: string;
  promotionStatus: PromotionStatus;
  portfolioId: string;
  availableCash: number;
  positions: PositionView[];
  totalMarketValue: number;
}

export async function getPortfolioView(userId: string): Promise<PortfolioView | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.promotionId) return null;

  const [portfolio, promotion] = await Promise.all([
    db.portfolio.findUnique({
      where: { userId_promotionId: { userId, promotionId: user.promotionId } },
      include: {
        positions: {
          where: { quantity: { gt: 0 }, closedAt: null },
          include: { asset: { include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
        },
      },
    }),
    db.promotion.findUnique({ where: { id: user.promotionId } }),
  ]);

  if (!portfolio || !promotion) return null;

  const availableCash = await computeAvailableCash(portfolio.id, Number(promotion.initialCapital));

  const positions: PositionView[] = portfolio.positions.map((position) => {
    const quantity = Number(position.quantity);
    const avgEntryPrice = Number(position.avgEntryPrice);
    const currentPrice = Number(position.asset.prices[0]?.price ?? avgEntryPrice);
    const marketValue = quantity * currentPrice;
    const costBasis = quantity * avgEntryPrice;

    return {
      assetId: position.assetId,
      symbol: position.asset.symbol,
      name: position.asset.name,
      assetType: position.asset.type,
      quantity,
      avgEntryPrice,
      currentPrice,
      marketValue,
      costBasis,
      pnl: marketValue - costBasis,
      pnlPct: costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0,
    };
  });

  return {
    promotionId: promotion.id,
    promotionName: promotion.name,
    promotionStatus: promotion.status,
    portfolioId: portfolio.id,
    availableCash,
    positions,
    totalMarketValue: positions.reduce((total, position) => total + position.marketValue, 0),
  };
}
