import "server-only";
import { AssetType } from "@/generated/prisma/enums";

/**
 * Seuil de péremption d'un prix, par type d'actif — partagé entre le
 * rafraîchissement "pull-through" (à l'affichage, voir pull-through.ts) et
 * l'ingestion planifiée (voir ingest.ts), pour que les deux mécanismes se
 * complètent sans jamais doubler la consommation de quota fournisseur : un
 * prix rafraîchi par l'un est considéré frais par l'autre.
 *
 * Brièvement descendu à 2 minutes le 2026-08-06, remonté à 10 minutes le
 * même jour après avoir constaté que Yahoo pouvait tomber en panne
 * silencieuse (voir yahoo-provider.ts, isStaleDuringMarketHours) — un seuil
 * bas multiplie les tentatives de rafraîchissement pendant une panne Yahoo,
 * donc multiplie d'autant les bascules réelles sur Twelve Data (fallback
 * pour les tickers US), qui, lui, a un vrai plafond gratuit : 8
 * requêtes/min, 800/jour. À ce seuil, un actif US suivi en continu par
 * Twelve Data coûterait 86 400 000 / STOCK_PRICE_STALE_MS = 144
 * requêtes/jour, donc le budget gratuit couvre environ 5 actifs US suivis
 * en continu si Yahoo restait en panne toute une journée (marge gardée
 * pour la recherche de tickers, qui consomme le même quota). Si Yahoo se
 * remet à fonctionner normalement, remonter davantage n'apporte plus rien
 * de dangereux ; si le nombre d'actifs/participants augmente
 * significativement, remonter encore ce seuil en premier réflexe.
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
