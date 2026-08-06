"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { executeOrder } from "@/lib/trading/execute-order";
import { ensureAssetForPurchase } from "@/lib/assets/ensure-asset";
import { evaluateUserBadgesForUser, type AwardedBadge } from "@/lib/gamification/evaluate-badges";
import { amountOrderSchema, dynamicBuySchema, sellPartialSchema } from "./schema";

export interface TradeFormState {
  error?: string;
  newBadges?: AwardedBadge[];
}

export async function buyAsset(
  _prevState: TradeFormState,
  formData: FormData,
): Promise<TradeFormState> {
  const session = await verifySession();
  const parsed = dynamicBuySchema.safeParse({
    symbol: formData.get("symbol"),
    name: formData.get("name"),
    type: formData.get("type"),
    externalId: formData.get("externalId") || undefined,
    currency: formData.get("currency") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const assetResult = await ensureAssetForPurchase(parsed.data);
  if (!assetResult.ok) {
    return { error: assetResult.error };
  }

  const result = await executeOrder(session.user.id, {
    type: "BUY",
    assetId: assetResult.asset.id,
    amount: parsed.data.amount,
  });
  if (!result.ok) {
    revalidatePath("/dashboard");
    return { error: result.reason };
  }

  const newBadges = await evaluateUserBadgesForUser(session.user.id);
  revalidatePath("/dashboard");
  return newBadges.length > 0 ? { newBadges } : {};
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
  if (!result.ok) {
    revalidatePath("/dashboard");
    return { error: result.reason };
  }

  const newBadges = await evaluateUserBadgesForUser(session.user.id);
  revalidatePath("/dashboard");
  return newBadges.length > 0 ? { newBadges } : {};
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
  if (!result.ok) {
    revalidatePath("/dashboard");
    return { error: result.reason };
  }

  const newBadges = await evaluateUserBadgesForUser(session.user.id);
  revalidatePath("/dashboard");
  return newBadges.length > 0 ? { newBadges } : {};
}

export async function sellFull(assetId: string): Promise<TradeFormState> {
  const session = await verifySession();
  const result = await executeOrder(session.user.id, { type: "SELL_FULL", assetId });
  if (!result.ok) {
    revalidatePath("/dashboard");
    return { error: result.reason };
  }

  const newBadges = await evaluateUserBadgesForUser(session.user.id);
  revalidatePath("/dashboard");
  return newBadges.length > 0 ? { newBadges } : {};
}
