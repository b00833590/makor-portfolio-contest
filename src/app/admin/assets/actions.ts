"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createAssetSchema, updateAssetSchema } from "./schema";

export interface AssetFormState {
  error?: string;
}

function isDuplicateSymbolError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createAsset(
  _prevState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const session = await requireAdmin();

  const parsed = createAssetSchema.safeParse({
    symbol: formData.get("symbol"),
    name: formData.get("name"),
    type: formData.get("type"),
    sector: formData.get("sector") || undefined,
    currency: formData.get("currency") || "EUR",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  let asset;
  try {
    asset = await db.asset.create({ data: parsed.data });
  } catch (error) {
    if (isDuplicateSymbolError(error)) {
      return { error: `Le symbole "${parsed.data.symbol}" existe déjà.` };
    }
    throw error;
  }

  await logAudit({
    adminId: session.user.id,
    action: "asset.create",
    target: asset.id,
    after: parsed.data,
  });

  revalidatePath("/admin/assets");
  return {};
}

export async function updateAsset(
  assetId: string,
  _prevState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const session = await requireAdmin();

  const parsed = updateAssetSchema.safeParse({
    symbol: formData.get("symbol"),
    name: formData.get("name"),
    type: formData.get("type"),
    sector: formData.get("sector") || undefined,
    currency: formData.get("currency") || "EUR",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const before = await db.asset.findUniqueOrThrow({ where: { id: assetId } });

  try {
    await db.asset.update({ where: { id: assetId }, data: parsed.data });
  } catch (error) {
    if (isDuplicateSymbolError(error)) {
      return { error: `Le symbole "${parsed.data.symbol}" existe déjà.` };
    }
    throw error;
  }

  await logAudit({
    adminId: session.user.id,
    action: "asset.update",
    target: assetId,
    before: { symbol: before.symbol, name: before.name, type: before.type, sector: before.sector, currency: before.currency },
    after: parsed.data,
  });

  revalidatePath("/admin/assets");
  return {};
}

export async function toggleAssetActive(assetId: string, isActive: boolean) {
  const session = await requireAdmin();

  const asset = await db.asset.update({
    where: { id: assetId },
    data: { isActive },
  });

  await logAudit({
    adminId: session.user.id,
    action: "asset.toggle",
    target: assetId,
    after: { isActive: asset.isActive },
  });

  revalidatePath("/admin/assets");
}
