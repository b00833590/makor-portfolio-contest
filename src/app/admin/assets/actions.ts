"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { AssetType } from "@/generated/prisma/enums";
import { createAssetSchema } from "./schema";

export interface AssetFormState {
  error?: string;
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

  if (parsed.data.type === AssetType.CRYPTO) {
    const existingCrypto = await db.asset.findFirst({
      where: { type: AssetType.CRYPTO, isActive: true },
    });
    if (existingCrypto) {
      return {
        error: `Une seule crypto autorisée par règlement — "${existingCrypto.symbol}" est déjà active.`,
      };
    }
  }

  const asset = await db.asset.create({ data: parsed.data });

  await logAudit({
    adminId: session.user.id,
    action: "asset.create",
    target: asset.id,
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
