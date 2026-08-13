import { getParisHourMinute } from "./timezone";

/**
 * Fréquence de rafraîchissement (poll client `AutoRefresh` et fenêtre
 * `unstable_cache`) adaptée aux horaires de marché, heure de Paris :
 * - 9h-15h30 (Europe ouverte, US fermée) : 30 min
 * - 15h30-22h (Europe + US ouvertes) : 15 min
 * - 22h-9h (tout fermé) : aucun rafraîchissement automatique — un seul
 *   calcul sert toute la nuit, déclenché par le premier accès (voir
 *   NIGHT_REVALIDATE_MS plus bas).
 */
const MORNING_START_MINUTES = 9 * 60; // 9h00
const AFTERNOON_START_MINUTES = 15 * 60 + 30; // 15h30
const NIGHT_START_MINUTES = 22 * 60; // 22h00

export const MORNING_INTERVAL_MS = 30 * 60 * 1000;
export const AFTERNOON_INTERVAL_MS = 15 * 60 * 1000;
/** Pas un intervalle de poll (la nuit ne rafraîchit jamais automatiquement) — la fenêtre
 * `revalidate` du cache serveur pendant la nuit, dimensionnée sur sa durée totale (22h → 9h,
 * 11h) pour qu'un seul calcul, déclenché par le premier accès de la nuit, serve jusqu'au matin
 * sans jamais expirer entre-temps. */
export const NIGHT_REVALIDATE_MS = 11 * 60 * 60 * 1000;

export type RefreshTier = "morning" | "afternoon" | "night";

export function getRefreshTier(now: Date = new Date()): RefreshTier {
  const { hour, minute } = getParisHourMinute(now);
  const minutesSinceMidnight = hour * 60 + minute;
  if (minutesSinceMidnight >= AFTERNOON_START_MINUTES && minutesSinceMidnight < NIGHT_START_MINUTES) {
    return "afternoon";
  }
  if (minutesSinceMidnight >= MORNING_START_MINUTES && minutesSinceMidnight < AFTERNOON_START_MINUTES) {
    return "morning";
  }
  return "night";
}

/** `false` entre 22h et 9h (heure de Paris) : marchés américains et européens fermés, aucune
 * raison de rafraîchir automatiquement. */
export function isMarketHours(now: Date = new Date()): boolean {
  return getRefreshTier(now) !== "night";
}

/** Cadence de "coup d'œil" côté client (AutoRefresh). La nuit partage celle du matin — seul
 * `isMarketHours` décide si le tick déclenche réellement un `router.refresh()`, voir
 * auto-refresh.tsx — ça permet de détecter la réouverture des marchés à 9h sans jamais rafraîchir
 * entre-temps. */
export function getPollIntervalMs(now: Date = new Date()): number {
  return getRefreshTier(now) === "afternoon" ? AFTERNOON_INTERVAL_MS : MORNING_INTERVAL_MS;
}
