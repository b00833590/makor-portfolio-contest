import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { AssetType, type PromotionStatus } from "@/generated/prisma/enums";
import { refreshAssetPricesIfStale } from "@/lib/prices/pull-through";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { computeAvailableCash } from "./execute-order";

export interface PositionView {
  assetId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  logoUrl: string | null;
  quantity: number;
  avgEntryPrice: number;
  /** Date d'ouverture de la position (ISO), pour l'historique de cours "depuis l'achat". */
  openedAt: string;
  currentPrice: number;
  /** Montant investi à l'achat (Entry Value). */
  entryValue: number;
  /** Valeur actuelle de la position (Actual Value). */
  actualValue: number;
  /** Poids de la position dans le portefeuille total investi (%). */
  allocationPct: number;
  pnl: number;
  pnlPct: number;
  /** Variation du prix sur les dernières 24h (%), `null` si aucun historique n'existe encore. */
  dailyChangePct: number | null;
}

export interface PortfolioView {
  promotionId: string;
  promotionName: string;
  promotionStatus: PromotionStatus;
  portfolioId: string;
  initialCapital: number;
  availableCash: number;
  /** Nombre maximal de positions autorisées, configuré par l'admin (Promotion.rules) — relu à
   * chaque chargement, s'adapte automatiquement si l'admin modifie la limite en cours de saison. */
  maxPositions: number;
  positions: PositionView[];
  totalMarketValue: number;
  /** Capital disponible + valeur investie — la valeur totale réelle du compte. */
  totalValue: number;
  totalGainEur: number;
  totalGainPct: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pour chaque actif, le prix le plus récent à ou avant `cutoff` — une seule
 * requête groupée (plutôt qu'une par position) grâce à `distinct`.
 */
async function getDailyReferencePrices(assetIds: string[], cutoff: Date): Promise<Map<string, number>> {
  if (assetIds.length === 0) return new Map();

  const rows = await db.price.findMany({
    where: { assetId: { in: assetIds }, timestamp: { lte: cutoff } },
    orderBy: { timestamp: "desc" },
    distinct: ["assetId"],
  });

  return new Map(rows.map((row) => [row.assetId, Number(row.price)]));
}

function resolveLogoUrl(asset: { symbol: string; type: AssetType; logoUrl: string | null }): string | null {
  if (asset.logoUrl) return asset.logoUrl;
  if (asset.type === AssetType.STOCK) {
    return `https://images.financialmodelingprep.com/symbol/${asset.symbol}.png`;
  }
  return null;
}

export async function getPortfolioView(userId: string): Promise<PortfolioView | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.promotionId) return null;

  const [portfolio, promotion] = await Promise.all([
    db.portfolio.findUnique({
      where: { userId_promotionId: { userId, promotionId: user.promotionId } },
      include: {
        positions: {
          where: { quantity: { gt: 0 }, closedAt: null },
          include: { asset: { include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
        },
      },
    }),
    db.promotion.findUnique({ where: { id: user.promotionId } }),
  ]);

  if (!portfolio || !promotion) return null;

  const initialCapital = Number(promotion.initialCapital);
  const openPositions = portfolio.positions;

  const [availableCash, referencePrices, refreshedPrices] = await Promise.all([
    computeAvailableCash(portfolio.id, initialCapital),
    getDailyReferencePrices(
      openPositions.map((position) => position.assetId),
      new Date(Date.now() - DAY_MS),
    ),
    refreshAssetPricesIfStale(openPositions.map((position) => position.asset)),
  ]);

  function resolveCurrentPrice(position: (typeof openPositions)[number]): number {
    const refreshed = refreshedPrices.get(position.assetId);
    if (refreshed) return refreshed.price;
    return Number(position.asset.prices[0]?.price ?? position.avgEntryPrice);
  }

  const totalMarketValue = openPositions.reduce((total, position) => {
    const quantity = Number(position.quantity);
    return total + quantity * resolveCurrentPrice(position);
  }, 0);

  const positions: PositionView[] = openPositions.map((position) => {
    const quantity = Number(position.quantity);
    const avgEntryPrice = Number(position.avgEntryPrice);
    const currentPrice = resolveCurrentPrice(position);
    const actualValue = quantity * currentPrice;
    const entryValue = quantity * avgEntryPrice;
    const referencePrice = referencePrices.get(position.assetId);

    return {
      assetId: position.assetId,
      symbol: position.asset.symbol,
      name: position.asset.name,
      assetType: position.asset.type,
      logoUrl: resolveLogoUrl(position.asset),
      quantity,
      avgEntryPrice,
      openedAt: position.openedAt.toISOString(),
      currentPrice,
      entryValue,
      actualValue,
      allocationPct: totalMarketValue > 0 ? (actualValue / totalMarketValue) * 100 : 0,
      pnl: actualValue - entryValue,
      pnlPct: entryValue > 0 ? ((actualValue - entryValue) / entryValue) * 100 : 0,
      dailyChangePct:
        referencePrice && referencePrice > 0 ? ((currentPrice - referencePrice) / referencePrice) * 100 : null,
    };
  });

  const totalValue = availableCash + totalMarketValue;
  const totalGainEur = totalValue - initialCapital;

  return {
    promotionId: promotion.id,
    promotionName: promotion.name,
    promotionStatus: promotion.status,
    portfolioId: portfolio.id,
    initialCapital,
    availableCash,
    maxPositions: promotionRulesSchema.parse(promotion.rules).maxPositions,
    positions,
    totalMarketValue,
    totalValue,
    totalGainEur,
    totalGainPct: initialCapital > 0 ? (totalGainEur / initialCapital) * 100 : 0,
  };
}

/**
 * Variante mise en cache de {@link getPortfolioView} — même raisonnement que
 * {@link getCachedLeaderboard} (get-leaderboard.ts) : un refresh manuel du
 * dashboard, la page la plus visitée, contournait totalement `AutoRefresh`.
 *
 * `unstable_cache` ne permet pas un tag dynamique par utilisateur (le tag est
 * fixé à la définition, pas à l'appel) — on utilise donc un tag unique
 * `"portfolio-view"`, partagé par tous les participants : le trade d'un seul
 * utilisateur invalide le cache de tout le monde, ce qui reste correct (juste
 * légèrement moins optimal qu'un tag par utilisateur) et bien plus simple à
 * garder juste dans la durée — tout point de mutation (achat/vente côté
 * participant dans dashboard/actions.ts, correction admin dans
 * admin/portfolios/[portfolioId]/actions.ts et
 * admin/promotions/[id]/actions.ts) doit appeler `updateTag("portfolio-view")`
 * après avoir modifié positions/transactions. Si un point de mutation futur
 * oublie cet appel, la fenêtre `revalidate` de 60s reste le filet de sécurité.
 */
export const getCachedPortfolioView = unstable_cache(
  (userId: string) => getPortfolioView(userId),
  ["portfolio-view"],
  { revalidate: 60, tags: ["portfolio-view"] },
);
