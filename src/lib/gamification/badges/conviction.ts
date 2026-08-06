import type { BadgeSpec } from "./types";

const LE_BON_INSTINCT_GAIN_PCT = 15;

export interface BuyForGainScan {
  assetId: string;
  price: number;
  createdAt: Date;
}

export interface PriceHistoryPoint {
  price: number;
  timestamp: Date;
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Meilleur gain % atteint dans les 5 jours suivant un achat, tous achats confondus — `null` si
 * aucun achat n'a de données de prix postérieures disponibles.
 */
export function computeMaxPostBuyGainPct(
  buys: BuyForGainScan[],
  priceHistoryByAsset: Map<string, PriceHistoryPoint[]>,
): number | null {
  let best: number | null = null;

  for (const buy of buys) {
    if (buy.price <= 0) continue;
    const windowEnd = buy.createdAt.getTime() + FIVE_DAYS_MS;
    const pricesAfter = (priceHistoryByAsset.get(buy.assetId) ?? []).filter(
      (point) => point.timestamp.getTime() >= buy.createdAt.getTime() && point.timestamp.getTime() <= windowEnd,
    );
    for (const point of pricesAfter) {
      const gainPct = ((point.price - buy.price) / buy.price) * 100;
      if (best === null || gainPct > best) best = gainPct;
    }
  }

  return best;
}

export const convictionBadges: BadgeSpec[] = [
  {
    code: "LE_BON_INSTINCT",
    name: "Le bon instinct",
    description: "Vous avez acheté un actif juste avant une hausse d'au moins 15% dans les 5 jours suivants.",
    condition: "Acheter un actif qui prend au moins +15% dans les 5 jours suivant l'achat",
    category: "CONVICTION",
    rarity: "EPIC",
    icon: "🔮",
    evaluate: (ctx) => ctx.postBuyMaxGainPct !== null && ctx.postBuyMaxGainPct >= LE_BON_INSTINCT_GAIN_PCT,
  },
];

/**
 * Close-only : "conserver une position pendant TOUT le concours" ne peut être confirmé qu'à la
 * clôture (une position encore ouverte aujourd'hui peut être vendue demain) — voir
 * award-close-only-badges.ts.
 */
export const FIDELE_AU_POSTE: BadgeSpec = {
  code: "FIDELE_AU_POSTE",
  name: "Fidèle au poste",
  description: "Vous avez conservé une position ouverte du tout début à la toute fin du concours.",
  condition: "Conserver une position ouverte du début à la fin du concours",
  category: "CONVICTION",
  rarity: "EPIC",
  icon: "⚓",
};
