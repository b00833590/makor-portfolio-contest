import "server-only";
import { AssetType } from "@/generated/prisma/enums";

/**
 * Seuil de péremption d'un prix, par type d'actif — partagé entre le
 * rafraîchissement "pull-through" (à l'affichage, voir pull-through.ts) et
 * l'ingestion planifiée (voir ingest.ts), pour que les deux mécanismes se
 * complètent sans jamais doubler la consommation de quota fournisseur : un
 * prix rafraîchi par l'un est considéré frais par l'autre.
 *
 * Descendu de 10 à 2 minutes (2026-08-06) pour un rendu plus "vivant" —
 * accepté en connaissance de cause d'un risque de quota plus élevé. Yahoo
 * (fournisseur principal pour toutes les actions, voir yahoo-provider.ts)
 * n'a montré aucun mur de quota en pratique jusqu'ici, contrairement à
 * Twelve Data (fallback, limité aux tickers US) : 8 requêtes/min, 800/jour —
 * à ce seuil, un actif US suivi en continu par Twelve Data coûterait
 * 86 400 000 / STOCK_PRICE_STALE_MS ≈ 720 requêtes/jour, donc le budget
 * gratuit ne couvrirait qu'un seul actif US suivi en continu SI Yahoo
 * tombait en panne et que tout basculait sur Twelve Data. Si Yahoo se met un
 * jour à rate-limiter ou si le nombre de participants/actifs suivis
 * augmente significativement, remonter ce seuil en premier réflexe.
 */
export const STOCK_PRICE_STALE_MS = 2 * 60 * 1000;

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
