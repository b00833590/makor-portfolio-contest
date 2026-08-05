import "server-only";
import { db } from "@/lib/db";
import { AssetType } from "@/generated/prisma/enums";
import type { Asset } from "@/generated/prisma/client";
import { refreshAssetPriceIfStale } from "@/lib/prices/pull-through";

export interface AssetCandidate {
  symbol: string;
  name: string;
  type: AssetType;
  externalId?: string;
  currency?: string;
  logoUrl?: string;
}

export type EnsureAssetResult = { ok: true; asset: Asset } | { ok: false; error: string };

/**
 * Refuse une deuxième crypto active — un seul actif crypto autorisé par
 * règlement (docs/CONCEPTION.md §6). Utilisé aussi bien par la création
 * manuelle admin que par l'achat dynamique via recherche de ticker.
 */
export async function assertCryptoSlotAvailable(excludeAssetId?: string): Promise<string | null> {
  const existingCrypto = await db.asset.findFirst({
    where: { type: AssetType.CRYPTO, isActive: true, id: { not: excludeAssetId } },
  });
  if (existingCrypto) {
    return `Une seule crypto autorisée par règlement — "${existingCrypto.symbol}" est déjà active.`;
  }
  return null;
}

/**
 * Récupère l'actif correspondant au ticker, ou le crée s'il n'existe pas
 * encore — sans toucher aux prix. Utilisé pour la correction manuelle admin
 * (le prix historique est saisi directement, pas rafraîchi depuis l'API).
 */
export async function ensureAssetExists(candidate: AssetCandidate): Promise<EnsureAssetResult> {
  const symbol = candidate.symbol.trim().toUpperCase();

  let asset = await db.asset.findUnique({ where: { symbol } });

  if (!asset) {
    if (candidate.type === AssetType.CRYPTO) {
      const cryptoError = await assertCryptoSlotAvailable();
      if (cryptoError) return { ok: false, error: cryptoError };
    }

    asset = await db.asset.create({
      data: {
        symbol,
        name: candidate.name,
        type: candidate.type,
        currency: candidate.currency ?? "EUR",
        externalId: candidate.externalId,
        logoUrl: candidate.logoUrl,
      },
    });
  }

  return { ok: true, asset };
}

/**
 * Récupère l'actif correspondant au ticker choisi dans la recherche, ou le
 * crée à la volée s'il n'existe pas encore. Rafraîchit toujours le prix pour
 * qu'un achat juste après création dispose d'une cotation valide.
 */
export async function ensureAssetForPurchase(candidate: AssetCandidate): Promise<EnsureAssetResult> {
  const result = await ensureAssetExists(candidate);
  if (!result.ok) return result;
  const { asset } = result;

  if (!asset.isActive) {
    return { ok: false, error: "Cet actif n'est plus disponible à l'achat." };
  }

  await refreshAssetPriceIfStale(asset);

  const hasPrice = await db.price.findFirst({ where: { assetId: asset.id } });
  if (!hasPrice) {
    return { ok: false, error: "Impossible de récupérer une cotation pour cet actif pour le moment. Réessayez plus tard." };
  }

  return { ok: true, asset };
}
