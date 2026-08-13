"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ensureAssetExists } from "@/lib/assets/ensure-asset";
import { recomputePortfolioPositions } from "@/lib/trading/recompute-portfolio";
import { recalculatePortfolioSnapshot } from "@/lib/trading/recalculate-snapshot";
import { createTransactionSchema, updateTransactionSchema } from "./schema";

export interface TransactionFormState {
  error?: string;
}

export async function createTransaction(
  portfolioId: string,
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const session = await requireAdmin();

  const parsed = createTransactionSchema.safeParse({
    symbol: formData.get("symbol"),
    name: formData.get("name"),
    assetType: formData.get("assetType"),
    type: formData.get("type"),
    externalId: formData.get("externalId") || undefined,
    currency: formData.get("currency") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    quantity: formData.get("quantity"),
    price: formData.get("price"),
    createdAt: formData.get("createdAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const assetResult = await ensureAssetExists({
    symbol: parsed.data.symbol,
    name: parsed.data.name,
    type: parsed.data.assetType,
    externalId: parsed.data.externalId,
    currency: parsed.data.currency,
    logoUrl: parsed.data.logoUrl,
  });
  if (!assetResult.ok) {
    return { error: assetResult.error };
  }

  const amount = parsed.data.quantity * parsed.data.price;
  const transaction = await db.transaction.create({
    data: {
      portfolioId,
      assetId: assetResult.asset.id,
      type: parsed.data.type,
      quantity: parsed.data.quantity,
      price: parsed.data.price,
      amount,
      createdAt: parsed.data.createdAt,
    },
  });

  await recomputePortfolioPositions(portfolioId);

  await logAudit({
    adminId: session.user.id,
    action: "transaction.create",
    target: transaction.id,
    after: {
      portfolioId,
      symbol: parsed.data.symbol,
      type: parsed.data.type,
      quantity: parsed.data.quantity,
      price: parsed.data.price,
      createdAt: parsed.data.createdAt,
    },
  });

  revalidatePath(`/admin/portfolios/${portfolioId}`);
  updateTag("portfolio-view");
  return {};
}

export async function updateTransaction(
  portfolioId: string,
  transactionId: string,
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const session = await requireAdmin();

  const parsed = updateTransactionSchema.safeParse({
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    price: formData.get("price"),
    createdAt: formData.get("createdAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const before = await db.transaction.findUniqueOrThrow({ where: { id: transactionId } });
  const amount = parsed.data.quantity * parsed.data.price;

  await db.transaction.update({
    where: { id: transactionId },
    data: {
      type: parsed.data.type,
      quantity: parsed.data.quantity,
      price: parsed.data.price,
      amount,
      createdAt: parsed.data.createdAt,
    },
  });

  await recomputePortfolioPositions(portfolioId);

  await logAudit({
    adminId: session.user.id,
    action: "transaction.update",
    target: transactionId,
    before: {
      type: before.type,
      quantity: before.quantity,
      price: before.price,
      createdAt: before.createdAt,
    },
    after: parsed.data,
  });

  revalidatePath(`/admin/portfolios/${portfolioId}`);
  updateTag("portfolio-view");
  return {};
}

export async function deleteTransaction(portfolioId: string, transactionId: string) {
  const session = await requireAdmin();

  const before = await db.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { asset: { select: { symbol: true } } },
  });

  await db.transaction.delete({ where: { id: transactionId } });
  await recomputePortfolioPositions(portfolioId);

  await logAudit({
    adminId: session.user.id,
    action: "transaction.delete",
    target: transactionId,
    before: {
      symbol: before.asset.symbol,
      type: before.type,
      quantity: before.quantity,
      price: before.price,
      createdAt: before.createdAt,
    },
  });

  revalidatePath(`/admin/portfolios/${portfolioId}`);
  updateTag("portfolio-view");
}

export async function recalculateSnapshot(portfolioId: string) {
  const session = await requireAdmin();

  await recalculatePortfolioSnapshot(portfolioId);

  await logAudit({
    adminId: session.user.id,
    action: "portfolio.recalculate",
    target: portfolioId,
  });

  revalidatePath(`/admin/portfolios/${portfolioId}`);
  updateTag("portfolio-view");
}
