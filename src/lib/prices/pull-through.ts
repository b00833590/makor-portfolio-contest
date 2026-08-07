import "server-only";
import { db } from "@/lib/db";
import { getPriceProviders } from "@/lib/prices";
import { isPriceStale } from "@/lib/prices/staleness";
import { fetchPriceWithFallback } from "@/lib/prices/provider-fallback";
import type { Asset } from "@/generated/prisma/client";
import type { PriceProvider } from "./types";

type AssetForRefresh = Pick<Asset, "id" | "symbol" | "type" | "currency" | "externalId">;

export interface RefreshedPrice {
  price: number;
  timestamp: Date;
  /** `true` si la cotation est périmée mais qu'aucune nouvelle valeur n'a pu être obtenue. */
  isStale: boolean;
}

/**
 * Rafraîchissements réellement en cours, par actif — partagés entre tous les
 * appels concurrents de ce process. Sans ça, plusieurs participants chargeant
 * leur tableau de bord (ou dashboard + classement) au même instant, juste
 * quand un actif dépasse le seuil de péremption, verraient chacun le même
 * prix périmé en base et déclencheraient chacun son propre appel fournisseur
 * pour le même actif — jusqu'à N appels redondants au lieu d'1 seul, ce qui
 * ronge le quota gratuit (Twelve Data notamment, voir staleness.ts) sans
 * bénéfice de fraîcheur. La map ne retient qu'un travail EN COURS, jamais une
 * valeur : elle s'auto-nettoie dès que l'appel se termine (succès ou échec).
 *
 * Limite assumée : ceci ne coalesce que les requêtes traitées par la même
 * instance serverless. Deux instances distinctes recevant une requête pour le
 * même actif au même instant pourraient encore, en théorie, déclencher 2
 * appels au lieu d'1 — un verrou distribué (advisory lock Postgres, comme
 * dans execute-order.ts) l'empêcherait totalement, mais nécessiterait de
 * garder une transaction ouverte pendant tout l'appel HTTP au fournisseur, ce
 * qui immobiliserait une connexion du pool pendant un temps réseau
 * imprévisible — un compromis jugé pire que le risque résiduel à l'échelle de
 * ce concours (quelques dizaines de participants).
 */
const inFlightRefreshes = new Map<string, Promise<RefreshedPrice | null>>();

async function fetchAndStore(asset: AssetForRefresh, providers: PriceProvider[]): Promise<RefreshedPrice | null> {
  const quote = await fetchPriceWithFallback(providers, asset);
  if (!quote) return null;

  await db.price.create({
    data: { assetId: asset.id, timestamp: quote.timestamp, price: quote.price, source: quote.source },
  });
  return { price: quote.price, timestamp: quote.timestamp, isStale: false };
}

function refreshWithDedupe(asset: AssetForRefresh, providers: PriceProvider[]): Promise<RefreshedPrice | null> {
  const inFlight = inFlightRefreshes.get(asset.id);
  if (inFlight) return inFlight;

  const promise = fetchAndStore(asset, providers).finally(() => {
    inFlightRefreshes.delete(asset.id);
  });
  inFlightRefreshes.set(asset.id, promise);
  return promise;
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
  const staleAssets = assets.filter((asset) => isPriceStale(latestByAsset.get(asset.id)?.timestamp, asset.type, now));
  const providers = staleAssets.length > 0 ? getPriceProviders() : [];

  await Promise.all(
    assets.map(async (asset) => {
      const latest = latestByAsset.get(asset.id);
      const isStale = isPriceStale(latest?.timestamp, asset.type, now);

      if (!isStale) {
        result.set(asset.id, { price: Number(latest!.price), timestamp: latest!.timestamp, isStale: false });
        return;
      }

      const refreshed = await refreshWithDedupe(asset, providers);

      if (refreshed) {
        result.set(asset.id, refreshed);
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
