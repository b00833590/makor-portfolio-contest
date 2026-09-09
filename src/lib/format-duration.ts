const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Temps restant avant `endDate`, arrondi à l'unité la plus lisible — jours
 * s'il en reste au moins un, sinon heures (jamais "0 heure", au moins 1 pour
 * ne pas annoncer un concours terminé qui ne l'est pas encore). Utilisé par
 * la vue d'ensemble d'un concours dans l'espace Directeur.
 */
export function formatTimeRemaining(endDate: Date, now: Date = new Date()): string {
  const diffMs = endDate.getTime() - now.getTime();
  if (diffMs <= 0) return "Terminé";

  const days = Math.floor(diffMs / DAY_MS);
  if (days >= 1) return `${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`;

  const hours = Math.max(1, Math.round(diffMs / HOUR_MS));
  return `${hours} heure${hours > 1 ? "s" : ""} restante${hours > 1 ? "s" : ""}`;
}
