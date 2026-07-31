import "server-only";
import { db } from "@/lib/db";
import { ChangeSessionStatus, TransactionType } from "@/generated/prisma/enums";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { validateOrder } from "./rules-engine";
import type { PositionContext, TradeContext, TradeOrderInput, TradeValidationResult } from "./types";

export async function computeAvailableCash(portfolioId: string, initialCapital: number): Promise<number> {
  const transactions = await db.transaction.findMany({
    where: { portfolioId },
    select: { type: true, amount: true },
  });

  return transactions.reduce((cash, transaction) => {
    const amount = Number(transaction.amount);
    const isInflow = transaction.type === TransactionType.SELL_FULL || transaction.type === TransactionType.SELL_PARTIAL;
    return isInflow ? cash + amount : cash - amount;
  }, initialCapital);
}

async function loadPositionsContext(portfolioId: string): Promise<PositionContext[]> {
  const positions = await db.position.findMany({
    where: { portfolioId, quantity: { gt: 0 }, closedAt: null },
    include: { asset: { include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
  });

  return positions.map((position) => ({
    assetId: position.assetId,
    assetType: position.asset.type,
    quantity: Number(position.quantity),
    avgEntryPrice: Number(position.avgEntryPrice),
    currentPrice: Number(position.asset.prices[0]?.price ?? position.avgEntryPrice),
  }));
}

export async function getOpenChangeSession(promotionId: string, now: Date = new Date()) {
  return db.changeSession.findFirst({
    where: {
      promotionId,
      status: ChangeSessionStatus.OPEN,
      opensAt: { lte: now },
      closesAt: { gte: now },
    },
  });
}

export async function buildTradeContext(
  userId: string,
  assetId: string,
  now: Date = new Date(),
): Promise<{ context: TradeContext; portfolioId: string; changeSessionId: string | null } | { error: string }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.promotionId) {
    return { error: "Vous n'êtes assigné à aucune promotion en cours." };
  }

  const [portfolio, promotion, asset] = await Promise.all([
    db.portfolio.findUnique({
      where: { userId_promotionId: { userId, promotionId: user.promotionId } },
    }),
    db.promotion.findUniqueOrThrow({ where: { id: user.promotionId } }),
    db.asset.findUnique({ where: { id: assetId }, include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } }),
  ]);

  if (!portfolio) {
    return { error: "Aucun portefeuille trouvé pour cette promotion." };
  }
  if (!asset) {
    return { error: "Actif introuvable." };
  }
  const latestPrice = asset.prices[0]?.price;
  if (latestPrice === undefined) {
    return { error: "Aucun prix disponible pour cet actif." };
  }

  const changeSession = await getOpenChangeSession(promotion.id, now);
  const changesUsed = changeSession
    ? (await db.changeUsage.findUnique({
        where: { changeSessionId_userId: { changeSessionId: changeSession.id, userId } },
      }))?.changesUsed ?? 0
    : 0;

  const [positions, availableCash] = await Promise.all([
    loadPositionsContext(portfolio.id),
    computeAvailableCash(portfolio.id, Number(promotion.initialCapital)),
  ]);

  const context: TradeContext = {
    now,
    promotion: {
      status: promotion.status,
      endDate: promotion.endDate,
      rules: promotionRulesSchema.parse(promotion.rules),
    },
    changeSession: changeSession
      ? {
          status: changeSession.status,
          opensAt: changeSession.opensAt,
          closesAt: changeSession.closesAt,
          maxChangesPerParticipant: changeSession.maxChangesPerParticipant,
        }
      : null,
    changesUsed,
    availableCash,
    positions,
    asset: { id: asset.id, type: asset.type, isActive: asset.isActive, currentPrice: Number(latestPrice) },
  };

  return { context, portfolioId: portfolio.id, changeSessionId: changeSession?.id ?? null };
}

async function applyOrder(
  portfolioId: string,
  changeSessionId: string | null,
  userId: string,
  order: TradeOrderInput,
  currentPrice: number,
): Promise<void> {
  await db.$transaction(async (tx) => {
    let quantity: number;
    let amount: number;

    if (order.type === "BUY") {
      quantity = order.amount / currentPrice;
      amount = order.amount;
      await tx.position.create({
        data: {
          portfolioId,
          assetId: order.assetId,
          quantity,
          avgEntryPrice: currentPrice,
        },
      });
    } else if (order.type === "INCREASE") {
      const existing = await tx.position.findFirstOrThrow({
        where: { portfolioId, assetId: order.assetId, quantity: { gt: 0 }, closedAt: null },
      });
      const addedQuantity = order.amount / currentPrice;
      const oldQuantity = Number(existing.quantity);
      const oldAvgPrice = Number(existing.avgEntryPrice);
      const newQuantity = oldQuantity + addedQuantity;
      const newAvgPrice = (oldQuantity * oldAvgPrice + order.amount) / newQuantity;

      quantity = addedQuantity;
      amount = order.amount;
      await tx.position.update({
        where: { id: existing.id },
        data: { quantity: newQuantity, avgEntryPrice: newAvgPrice },
      });
    } else if (order.type === "SELL_PARTIAL") {
      const existing = await tx.position.findFirstOrThrow({
        where: { portfolioId, assetId: order.assetId, quantity: { gt: 0 }, closedAt: null },
      });
      quantity = order.quantity;
      amount = order.quantity * currentPrice;
      await tx.position.update({
        where: { id: existing.id },
        data: { quantity: Number(existing.quantity) - order.quantity },
      });
    } else {
      const existing = await tx.position.findFirstOrThrow({
        where: { portfolioId, assetId: order.assetId, quantity: { gt: 0 }, closedAt: null },
      });
      quantity = Number(existing.quantity);
      amount = quantity * currentPrice;
      await tx.position.update({
        where: { id: existing.id },
        data: { quantity: 0, closedAt: new Date() },
      });
    }

    await tx.transaction.create({
      data: {
        portfolioId,
        assetId: order.assetId,
        type: order.type as TransactionType,
        quantity,
        price: currentPrice,
        amount,
        changeSessionId,
      },
    });

    if (changeSessionId) {
      await tx.changeUsage.upsert({
        where: { changeSessionId_userId: { changeSessionId, userId } },
        create: { changeSessionId, userId, changesUsed: 1 },
        update: { changesUsed: { increment: 1 } },
      });
    }
  });
}

export async function executeOrder(
  userId: string,
  order: TradeOrderInput,
  now: Date = new Date(),
): Promise<TradeValidationResult> {
  const built = await buildTradeContext(userId, order.assetId, now);
  if ("error" in built) {
    return { ok: false, reason: built.error };
  }

  const { context, portfolioId, changeSessionId } = built;
  const validation = validateOrder(order, context);
  if (!validation.ok) {
    return validation;
  }

  await applyOrder(portfolioId, changeSessionId, userId, order, context.asset.currentPrice);
  return { ok: true };
}
