"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { executeOrder } from "@/lib/trading/execute-order";
import { amountOrderSchema, sellPartialSchema } from "./schema";

export interface TradeFormState {
  error?: string;
}

export async function buyAsset(
  _prevState: TradeFormState,
  formData: FormData,
): Promise<TradeFormState> {
  const session = await verifySession();
  const parsed = amountOrderSchema.safeParse({
    assetId: formData.get("assetId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const result = await executeOrder(session.user.id, {
    type: "BUY",
    assetId: parsed.data.assetId,
    amount: parsed.data.amount,
  });

  revalidatePath("/dashboard");
  return result.ok ? {} : { error: result.reason };
}

export async function increasePosition(
  _prevState: TradeFormState,
  formData: FormData,
): Promise<TradeFormState> {
  const session = await verifySession();
  const parsed = amountOrderSchema.safeParse({
    assetId: formData.get("assetId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const result = await executeOrder(session.user.id, {
    type: "INCREASE",
    assetId: parsed.data.assetId,
    amount: parsed.data.amount,
  });

  revalidatePath("/dashboard");
  return result.ok ? {} : { error: result.reason };
}

export async function sellPartial(
  _prevState: TradeFormState,
  formData: FormData,
): Promise<TradeFormState> {
  const session = await verifySession();
  const parsed = sellPartialSchema.safeParse({
    assetId: formData.get("assetId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const result = await executeOrder(session.user.id, {
    type: "SELL_PARTIAL",
    assetId: parsed.data.assetId,
    quantity: parsed.data.quantity,
  });

  revalidatePath("/dashboard");
  return result.ok ? {} : { error: result.reason };
}

export async function sellFull(assetId: string): Promise<TradeFormState> {
  const session = await verifySession();
  const result = await executeOrder(session.user.id, { type: "SELL_FULL", assetId });

  revalidatePath("/dashboard");
  return result.ok ? {} : { error: result.reason };
}
