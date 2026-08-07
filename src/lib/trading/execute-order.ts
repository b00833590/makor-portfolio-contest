import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ChangeSessionStatus, TransactionType } from "@/generated/prisma/enums";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { validateOrder } from "./rules-engine";
import type { PositionContext, TradeContext, TradeOrderInput, TradeValidationResult } from "./types";

/** `db` en temps normal, ou le client de transaction quand on est déjà dans un `$transaction`. */
type DbClient = typeof db | Prisma.TransactionClient;

export async function computeAvailableCash(
  portfolioId: string,
  initialCapital: number,
  client: DbClient = db,
): Promise<number> {
  const transactions = await client.transaction.findMany({
    where: { portfolioId },
    select: { type: true, amount: true },
  });

  return transactions.reduce((cash, transaction) => {
    const amount = Number(transaction.amount);
    const isInflow = transaction.type === TransactionType.SELL_FULL || transaction.type === TransactionType.SELL_PARTIAL;
    return isInflow ? cash + amount : cash - amount;
  }, initialCapital);
}

async function loadPositionsContext(portfolioId: string, client: DbClient): Promise<PositionContext[]> {
  const positions = await client.position.findMany({
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

/**
 * La session "effectivement ouverte" est calculée directement dans la requête,
 * en miroir de computeChangeSessionStatus : soit une session en mode
 * automatique (status SCHEDULED, jamais touchée par l'admin) dont l'heure
 * actuelle tombe dans sa fenêtre, soit une session forcée ouverte par
 * dérogation admin ("Ouvrir maintenant") tant que closesAt n'est pas dépassé.
 * `orderBy` est un filet de sécurité si deux sessions se chevauchaient malgré
 * la validation à la création (voir createChangeSession) — la plus récemment
 * ouverte gagne plutôt qu'un choix arbitraire.
 */
export async function getOpenChangeSession(promotionId: string, now: Date = new Date(), client: DbClient = db) {
  return client.changeSession.findFirst({
    where: {
      promotionId,
      OR: [
        { status: ChangeSessionStatus.SCHEDULED, opensAt: { lte: now }, closesAt: { gte: now } },
        { status: ChangeSessionStatus.OPEN, closesAt: { gte: now } },
      ],
    },
    orderBy: { opensAt: "desc" },
  });
}

/**
 * Prochaine session à venir (aucune ouverte actuellement) — pour l'affichage
 * participant "prochaine session de changement" sur le tableau de bord. Ne
 * renvoie que des sessions en mode automatique : une session forcée fermée
 * par avance (status CLOSED) n'est délibérément jamais proposée comme "à venir".
 */
export async function getNextScheduledChangeSession(promotionId: string, now: Date = new Date(), client: DbClient = db) {
  return client.changeSession.findFirst({
    where: { promotionId, status: ChangeSessionStatus.SCHEDULED, opensAt: { gt: now } },
    orderBy: { opensAt: "asc" },
  });
}

export async function buildTradeContext(
  userId: string,
  assetId: string,
  now: Date = new Date(),
  client: DbClient = db,
): Promise<{ context: TradeContext; portfolioId: string; changeSessionId: string | null } | { error: string }> {
  const user = await client.user.findUnique({ where: { id: userId } });
  if (!user?.promotionId) {
    return { error: "Vous n'êtes assigné à aucune promotion en cours." };
  }

  const [portfolio, promotion, asset] = await Promise.all([
    client.portfolio.findUnique({
      where: { userId_promotionId: { userId, promotionId: user.promotionId } },
    }),
    client.promotion.findUniqueOrThrow({ where: { id: user.promotionId } }),
    client.asset.findUnique({ where: { id: assetId }, include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } }),
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

  const changeSession = await getOpenChangeSession(promotion.id, now, client);
  const changesUsed = changeSession
    ? (await client.changeUsage.findUnique({
        where: { changeSessionId_userId: { changeSessionId: changeSession.id, userId } },
      }))?.changesUsed ?? 0
    : 0;

  const [positions, availableCash] = await Promise.all([
    loadPositionsContext(portfolio.id, client),
    computeAvailableCash(portfolio.id, Number(promotion.initialCapital), client),
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
          kind: changeSession.kind,
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
  client: DbClient,
  portfolioId: string,
  changeSessionId: string | null,
  userId: string,
  order: TradeOrderInput,
  currentPrice: number,
): Promise<void> {
  let quantity: number;
  let amount: number;

  if (order.type === "BUY") {
    quantity = order.amount / currentPrice;
    amount = order.amount;
    await client.position.create({
      data: {
        portfolioId,
        assetId: order.assetId,
        quantity,
        avgEntryPrice: currentPrice,
      },
    });
  } else if (order.type === "INCREASE") {
    const existing = await client.position.findFirstOrThrow({
      where: { portfolioId, assetId: order.assetId, quantity: { gt: 0 }, closedAt: null },
    });
    const addedQuantity = order.amount / currentPrice;
    const oldQuantity = Number(existing.quantity);
    const oldAvgPrice = Number(existing.avgEntryPrice);
    const newQuantity = oldQuantity + addedQuantity;
    const newAvgPrice = (oldQuantity * oldAvgPrice + order.amount) / newQuantity;

    quantity = addedQuantity;
    amount = order.amount;
    await client.position.update({
      where: { id: existing.id },
      data: { quantity: newQuantity, avgEntryPrice: newAvgPrice },
    });
  } else if (order.type === "SELL_PARTIAL") {
    const existing = await client.position.findFirstOrThrow({
      where: { portfolioId, assetId: order.assetId, quantity: { gt: 0 }, closedAt: null },
    });
    quantity = order.quantity;
    amount = order.quantity * currentPrice;
    await client.position.update({
      where: { id: existing.id },
      data: { quantity: Number(existing.quantity) - order.quantity },
    });
  } else {
    const existing = await client.position.findFirstOrThrow({
      where: { portfolioId, assetId: order.assetId, quantity: { gt: 0 }, closedAt: null },
    });
    quantity = Number(existing.quantity);
    amount = quantity * currentPrice;
    await client.position.update({
      where: { id: existing.id },
      data: { quantity: 0, closedAt: new Date() },
    });
  }

  await client.transaction.create({
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
    await client.changeUsage.upsert({
      where: { changeSessionId_userId: { changeSessionId, userId } },
      create: { changeSessionId, userId, changesUsed: 1 },
      update: { changesUsed: { increment: 1 } },
    });
  }
}

/**
 * Lecture du contexte, validation des règles, puis écriture forment un seul
 * bloc atomique et sérialisé par participant. Sans ça, deux ordres du même
 * utilisateur envoyés en même temps (double-clic, deux onglets, retry réseau)
 * liraient tous les deux le même instantané (cash disponible, positions
 * ouvertes, quota de changements) et pourraient passer la validation
 * ensemble — dépassement du capital, du nombre max de positions/cryptos, ou
 * du quota de changements. Le verrou advisory Postgres par utilisateur force
 * ces ordres à s'exécuter l'un après l'autre ; l'index unique partiel sur
 * Position (voir schema.prisma) est le filet de sécurité en base si jamais
 * ce verrou était contourné.
 */
export async function executeOrder(
  userId: string,
  order: TradeOrderInput,
  now: Date = new Date(),
): Promise<TradeValidationResult> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const built = await buildTradeContext(userId, order.assetId, now, tx);
    if ("error" in built) {
      return { ok: false, reason: built.error };
    }

    const { context, portfolioId, changeSessionId } = built;
    const validation = validateOrder(order, context);
    if (!validation.ok) {
      return validation;
    }

    await applyOrder(tx, portfolioId, changeSessionId, userId, order, context.asset.currentPrice);
    return { ok: true };
  });
}
