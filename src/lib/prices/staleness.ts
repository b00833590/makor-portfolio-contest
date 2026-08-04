import "server-only";
import { AssetType } from "@/generated/prisma/enums";

/**
 * Seuil de péremption d'un prix, par type d'actif — partagé entre le
 * rafraîchissement "pull-through" (à l'affichage, voir pull-through.ts) et
 * l'ingestion planifiée (voir ingest.ts), pour que les deux mécanismes se
 * complètent sans jamais doubler la consommation de quota fournisseur : un
 * prix rafraîchi par l'un est considéré frais par l'autre.
 *
 * Actions (Twelve Data, gratuit) : 8 requêtes/min, 800/jour. Avec ce seuil,
 * un actif suivi en continu (vu ou ingéré à chaque expiration) coûte
 * 86 400 000 / STOCK_PRICE_STALE_MS requêtes/jour — soit ~144/jour ici, donc
 * un budget de 800/jour couvre environ 5 actions suivies en continu (marge
 * gardée pour la recherche de tickers, qui consomme le même quota). Au-delà,
 * remonter ce seuil ou passer sur une clé Twelve Data payante.
 */
export const STOCK_PRICE_STALE_MS = 10 * 60 * 1000;

/**
 * Binance (public, sans clé) n'impose pas de quota comparable, et le
 * règlement n'autorise qu'une seule cryptomonnaie active à la fois
 * (docs/CONCEPTION.md section 6) — un seuil bas est donc sans risque et
 * donne une fraîcheur quasi temps réel.
 */
export const CRYPTO_PRICE_STALE_MS = 10 * 1000;

export function getPriceStaleMs(type: AssetType): number {
  return type === AssetType.CRYPTO ? CRYPTO_PRICE_STALE_MS : STOCK_PRICE_STALE_MS;
}

/** `true` si `latestTimestamp` est absent ou plus vieux que le seuil applicable à `type`. */
export function isPriceStale(latestTimestamp: Date | undefined, type: AssetType, now: Date): boolean {
  if (!latestTimestamp) return true;
  return now.getTime() - latestTimestamp.getTime() > getPriceStaleMs(type);
}
