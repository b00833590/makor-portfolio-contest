import "server-only";
import { db } from "@/lib/db";
import { getPriceProviders } from "@/lib/prices";
import type { Asset } from "@/generated/prisma/client";

/** Au-delà de ce délai, un prix est jugé périmé et redemandé au fournisseur. */
export const PRICE_STALE_MS = 15 * 60 * 1000;

type AssetForRefresh = Pick<Asset, "id" | "symbol" | "type" | "currency" | "externalId">;

export interface RefreshedPrice {
  price: number;
  timestamp: Date;
  /** `true` si la cotation est périmée mais qu'aucune nouvelle valeur n'a pu être obtenue. */
  isStale: boolean;
}

/**
 * Rafraîchit en un seul lot les prix de plusieurs actifs périmés (ou absents),
 * en parallélisant les appels aux fournisseurs — c'est ce qui garde le
 * rafraîchissement "live" à chaque page vue sans dépasser les limites des API
 * gratuites (pas de cron fréquent, voir docs/CONCEPTION.md) : un seul appel
 * réseau par actif réellement périmé, jamais par simple affichage.
 *
 * Retourne le prix courant (rafraîchi ou déjà valide) de chaque actif fourni,
 * pour éviter à l'appelant une seconde lecture en base après coup.
 */
export async function refreshAssetPricesIfStale(
  assets: AssetForRefresh[],
  now: Date = new Date(),
): Promise<Map<string, RefreshedPrice>> {
  const result = new Map<string, RefreshedPrice>();
  if (assets.length === 0) return result;

  const assetIds = assets.map((asset) => asset.id);
  const latestRows = await db.price.findMany({
    where: { assetId: { in: assetIds } },
    orderBy: { timestamp: "desc" },
    distinct: ["assetId"],
  });
  const latestByAsset = new Map(latestRows.map((row) => [row.assetId, row]));
  const staleAssets = assets.filter((asset) => {
    const latest = latestByAsset.get(asset.id);
    return !latest || now.getTime() - latest.timestamp.getTime() > PRICE_STALE_MS;
  });
  const providers = staleAssets.length > 0 ? getPriceProviders() : [];

  await Promise.all(
    assets.map(async (asset) => {
      const latest = latestByAsset.get(asset.id);
      const isStale = !latest || now.getTime() - latest.timestamp.getTime() > PRICE_STALE_MS;

      if (!isStale) {
        result.set(asset.id, { price: Number(latest!.price), timestamp: latest!.timestamp, isStale: false });
        return;
      }

      const provider = providers.find((candidate) => candidate.supports(asset));
      const quote = provider ? await provider.fetchPrice(asset) : null;

      if (quote) {
        await db.price.create({
          data: { assetId: asset.id, timestamp: quote.timestamp, price: quote.price, source: quote.source },
        });
        result.set(asset.id, { price: quote.price, timestamp: quote.timestamp, isStale: false });
      } else if (latest) {
        result.set(asset.id, { price: Number(latest.price), timestamp: latest.timestamp, isStale: true });
      }
    }),
  );

  return result;
}

/** Variante mono-actif de {@link refreshAssetPricesIfStale}, pour l'achat dynamique d'un seul ticker. */
export async function refreshAssetPriceIfStale(asset: AssetForRefresh, now: Date = new Date()): Promise<void> {
  await refreshAssetPricesIfStale([asset], now);
}
