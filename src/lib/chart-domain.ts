/**
 * Domaine d'axe Y resserré autour des valeurs réellement affichées, avec une marge de lecture
 * au-dessus et en dessous — évite qu'un axe parti de zéro (comportement par défaut de Recharts)
 * écrase les variations réelles quand les valeurs sont toutes proches les unes des autres (ex.
 * portefeuilles proches d'1 M€). La marge est proportionnelle à l'étendue réelle des données, pas
 * une valeur arbitraire, pour rester représentative plutôt que trompeuse.
 */
export function computeTightDomain(values: number[]): [number, number] | undefined {
  if (values.length === 0) return undefined;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.05, 1);
    return [min - padding, max + padding];
  }
  const padding = (max - min) * 0.12;
  return [min - padding, max + padding];
}
