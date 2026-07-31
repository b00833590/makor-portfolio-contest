import "server-only";
import { db } from "@/lib/db";
import type { TransactionType } from "@/generated/prisma/enums";

export interface TransactionHistoryItem {
  id: string;
  type: TransactionType;
  symbol: string;
  quantity: number;
  price: number;
  amount: number;
  createdAt: Date;
}

export async function getTransactionHistory(portfolioId: string): Promise<TransactionHistoryItem[]> {
  const transactions = await db.transaction.findMany({
    where: { portfolioId },
    orderBy: { createdAt: "desc" },
    include: { asset: { select: { symbol: true } } },
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    symbol: transaction.asset.symbol,
    quantity: Number(transaction.quantity),
    price: Number(transaction.price),
    amount: Number(transaction.amount),
    createdAt: transaction.createdAt,
  }));
}
