const standardFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Formatte le COURS UNITAIRE d'un actif (pas un montant total — pour ça,
 * garder un `Intl.NumberFormat` standard à 2 décimales). En dessous d'un
 * centime, la mise en forme "currency" par défaut affiche "0,00 €" quel que
 * soit le prix réel ou son évolution : un actif micro-cap (memecoin type
 * PEPE, ~0,000003 €) semble alors figé en permanence alors que son cours
 * bouge bel et bien à chaque rafraîchissement — c'est un problème
 * d'affichage, pas de récupération de prix (voir position-card.tsx,
 * position-price-chart.tsx, transaction-history-table.tsx). On élargit le
 * nombre de décimales sous ce seuil, juste assez pour garder ~3 chiffres
 * significatifs.
 */
export function formatUnitPrice(price: number): string {
  const abs = Math.abs(price);
  if (abs === 0 || abs >= 0.01) return standardFormatter.format(price);

  const decimals = Math.min(12, -Math.floor(Math.log10(abs)) + 2);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}
