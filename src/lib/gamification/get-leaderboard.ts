import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { refreshAssetPricesIfStale } from "@/lib/prices/pull-through";
import { computeAvailableCash } from "@/lib/trading/execute-order";
import { getRefreshTier, MORNING_INTERVAL_MS, AFTERNOON_INTERVAL_MS, NIGHT_REVALIDATE_MS } from "@/lib/refresh-schedule";
import { rankEntries, computeRankChange } from "./ranking";

export interface BestWorstPosition {
  symbol: string;
  name: string;
  pnlPct: number;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  portfolioId: string;
  totalValue: number;
  cumulativeReturnPct: number;
  rank: number;
  previousRank: number | null;
  /** Évolution du rang depuis la veille (positif = progression). */
  rankChange: number;
  /** Rendement sur les 7 derniers jours, ou null si l'historique est trop court. */
  weeklyReturnPct: number | null;
  bestPosition: BestWorstPosition | null;
  worstPosition: BestWorstPosition | null;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

interface EnrichedPosition extends BestWorstPosition {
  marketValue: number;
}

/**
 * Positions ouvertes de tous les portefeuilles d'une promotion, en un seul
 * lot — les prix périmés sont rafraîchis une seule fois pour l'ensemble des
 * actifs distincts détenus (cache pull-through), plutôt qu'une fois par
 * participant, pour que le classement reste réellement "temps réel" sans
 * multiplier les appels aux API de marché.
 *
 * `frozen` : concours clôturé — chaque position est valorisée au dernier cours
 * connu **≤ asOf** (aucun rafraîchissement fournisseur, aucun prix postérieur à
 * la fin officielle ne peut fausser le résultat). Le classement final est alors
 * déterministe et rejouable à l'identique indéfiniment. En mode normal (`asOf`
 * ≈ maintenant), `price ≤ asOf` = dernier prix connu, donc rien ne change.
 */
async function getPositionsByPortfolio(
  portfolioIds: string[],
  asOf: Date,
  frozen: boolean,
): Promise<Map<string, EnrichedPosition[]>> {
  const result = new Map<string, EnrichedPosition[]>();
  if (portfolioIds.length === 0) return result;

  const positions = await db.position.findMany({
    where: { portfolioId: { in: portfolioIds }, quantity: { gt: 0 }, closedAt: null },
    include: { asset: { include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
  });

  const distinctAssets = new Map(positions.map((position) => [position.assetId, position.asset]));

  const frozenPrices = new Map<string, number>();
  let refreshedPrices = new Map<string, { price: number }>();
  if (frozen) {
    const rows = await db.price.findMany({
      where: { assetId: { in: [...distinctAssets.keys()] }, timestamp: { lte: asOf } },
      orderBy: { timestamp: "desc" },
      distinct: ["assetId"],
    });
    for (const row of rows) frozenPrices.set(row.assetId, Number(row.price));
  } else {
    refreshedPrices = await refreshAssetPricesIfStale([...distinctAssets.values()], asOf);
  }

  for (const position of positions) {
    const quantity = Number(position.quantity);
    const avgEntryPrice = Number(position.avgEntryPrice);
    const currentPrice = frozen
      ? (frozenPrices.get(position.assetId) ?? Number(position.asset.prices[0]?.price ?? avgEntryPrice))
      : (refreshedPrices.get(position.assetId)?.price ?? Number(position.asset.prices[0]?.price ?? avgEntryPrice));
    const pnlPct = avgEntryPrice > 0 ? ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100 : 0;

    const entry: EnrichedPosition = {
      symbol: position.asset.symbol,
      name: position.asset.name,
      pnlPct,
      marketValue: quantity * currentPrice,
    };
    const list = result.get(position.portfolioId) ?? [];
    list.push(entry);
    result.set(position.portfolioId, list);
  }

  return result;
}

function pickBestWorst(positions: EnrichedPosition[]): { best: BestWorstPosition | null; worst: BestWorstPosition | null } {
  if (positions.length === 0) return { best: null, worst: null };
  const sorted = [...positions].sort((a, b) => b.pnlPct - a.pnlPct);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export async function getLeaderboard(
  promotionId: string,
  now: Date = new Date(),
  { frozen = false }: { frozen?: boolean } = {},
): Promise<LeaderboardRow[]> {
  const promotion = await db.promotion.findUniqueOrThrow({ where: { id: promotionId } });
  const initialCapital = Number(promotion.initialCapital);

  const portfolios = await db.portfolio.findMany({
    where: { promotionId },
    include: { user: { select: { id: true, name: true } } },
  });
  const portfolioIds = portfolios.map((portfolio) => portfolio.id);

  const yesterday = new Date(now.getTime() - ONE_DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  const [historyByPortfolio, positionsByPortfolio, cashByPortfolio] = await Promise.all([
    Promise.all(
      portfolios.map(async (portfolio) => {
        const [dayAgo, weekAgo] = await Promise.all([
          db.performanceSnapshot.findFirst({
            where: { portfolioId: portfolio.id, timestamp: { lte: yesterday } },
            orderBy: { timestamp: "desc" },
          }),
          db.performanceSnapshot.findFirst({
            where: { portfolioId: portfolio.id, timestamp: { lte: sevenDaysAgo } },
            orderBy: { timestamp: "desc" },
          }),
        ]);
        return [portfolio.id, { dayAgo, weekAgo }] as const;
      }),
    ).then((entries) => new Map(entries)),
    getPositionsByPortfolio(portfolioIds, now, frozen),
    Promise.all(
      portfolios.map(
        async (portfolio) => [portfolio.id, await computeAvailableCash(portfolio.id, initialCapital)] as const,
      ),
    ).then((entries) => new Map(entries)),
  ]);

  const currentEntries = portfolios.map((portfolio) => {
    const positions = positionsByPortfolio.get(portfolio.id) ?? [];
    const marketValue = positions.reduce((total, position) => total + position.marketValue, 0);
    const totalValue = (cashByPortfolio.get(portfolio.id) ?? initialCapital) + marketValue;
    const cumulativeReturnPct = initialCapital > 0 ? ((totalValue - initialCapital) / initialCapital) * 100 : 0;

    return { portfolioId: portfolio.id, totalValue, cumulativeReturnPct };
  });

  const previousDayEntries = portfolios
    .map((portfolio) => ({ portfolio, dayAgo: historyByPortfolio.get(portfolio.id)!.dayAgo }))
    .filter(({ dayAgo }) => dayAgo !== null)
    .map(({ portfolio, dayAgo }) => ({
      portfolioId: portfolio.id,
      cumulativeReturnPct: Number(dayAgo!.cumulativeReturnPct),
    }));

  const rankedCurrent = rankEntries(currentEntries);
  const rankedPreviousDay = rankEntries(previousDayEntries);
  const previousRankByPortfolio = new Map(rankedPreviousDay.map((entry) => [entry.portfolioId, entry.rank]));

  // Avatar (photo base64) chargé uniquement pour le podium (top 3), pas pour
  // tout le classement — cette page est ré-interrogée en continu par
  // AutoRefresh, retransmettre la photo des ~30 participants à chaque tick
  // dominait largement l'egress Supabase (voir incident du 2026-08). Le
  // reste de la liste utilise le repli initiales de UserAvatar.
  const podiumPortfolioIds = new Set(
    rankedCurrent.filter((entry) => entry.rank <= 3).map((entry) => entry.portfolioId),
  );
  const podiumUserIds = portfolios
    .filter((portfolio) => podiumPortfolioIds.has(portfolio.id))
    .map((portfolio) => portfolio.user.id);
  const podiumAvatars = await db.user.findMany({
    where: { id: { in: podiumUserIds } },
    select: { id: true, avatarUrl: true },
  });
  const avatarByUserId = new Map(podiumAvatars.map((user) => [user.id, user.avatarUrl]));

  return rankedCurrent
    .map((entry) => {
      const portfolio = portfolios.find((candidate) => candidate.id === entry.portfolioId)!;
      const { weekAgo } = historyByPortfolio.get(entry.portfolioId)!;
      const previousRank = previousRankByPortfolio.get(entry.portfolioId) ?? null;
      const weekAgoValue = weekAgo ? Number(weekAgo.totalValue) : null;
      const weeklyReturnPct =
        weekAgoValue && weekAgoValue !== 0 ? ((entry.totalValue - weekAgoValue) / weekAgoValue) * 100 : null;
      const { best, worst } = pickBestWorst(positionsByPortfolio.get(entry.portfolioId) ?? []);

      return {
        userId: portfolio.user.id,
        name: portfolio.user.name,
        avatarUrl: avatarByUserId.get(portfolio.user.id) ?? null,
        portfolioId: portfolio.id,
        totalValue: entry.totalValue,
        cumulativeReturnPct: entry.cumulativeReturnPct,
        rank: entry.rank,
        previousRank,
        rankChange: computeRankChange(entry.rank, previousRank),
        weeklyReturnPct,
        bestPosition: best,
        worstPosition: worst,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

/**
 * Variante mise en cache de {@link getLeaderboard}, à utiliser dans les pages
 * plutôt que la fonction brute — un rafraîchissement manuel (F5) ou une
 * navigation ne passent pas par `AutoRefresh` et n'étaient donc pas couverts
 * par l'intervalle de poll : sans ce cache serveur partagé, chaque
 * chargement de page, quel qu'en soit le déclencheur, ré-exécutait toutes
 * les requêtes Supabase. `unstable_cache` mutualise le résultat entre tous
 * les participants et toutes les requêtes pendant `revalidate` secondes,
 * donc même un utilisateur qui spam le rafraîchissement ne génère plus
 * qu'une requête réelle par fenêtre, peu importe le nombre de rechargements.
 *
 * Trois variantes (matin/après-midi/nuit, voir refresh-schedule.ts) plutôt
 * qu'une seule : `revalidate` est figé à la définition d'`unstable_cache`,
 * impossible à calculer dynamiquement à l'appel — `getCachedLeaderboard`
 * choisit entre les trois selon l'heure. Même tag sur les trois :
 * `updateTag("leaderboard")` (voir profil/actions.ts) invalide la variante
 * active quelle qu'elle soit.
 */
const getCachedLeaderboardMorning = unstable_cache(
  (promotionId: string) => getLeaderboard(promotionId),
  ["leaderboard", "morning"],
  { revalidate: MORNING_INTERVAL_MS / 1000, tags: ["leaderboard"] },
);
const getCachedLeaderboardAfternoon = unstable_cache(
  (promotionId: string) => getLeaderboard(promotionId),
  ["leaderboard", "afternoon"],
  { revalidate: AFTERNOON_INTERVAL_MS / 1000, tags: ["leaderboard"] },
);
const getCachedLeaderboardNight = unstable_cache(
  (promotionId: string) => getLeaderboard(promotionId),
  ["leaderboard", "night"],
  { revalidate: NIGHT_REVALIDATE_MS / 1000, tags: ["leaderboard"] },
);
export function getCachedLeaderboard(promotionId: string): Promise<LeaderboardRow[]> {
  const tier = getRefreshTier();
  if (tier === "afternoon") return getCachedLeaderboardAfternoon(promotionId);
  if (tier === "morning") return getCachedLeaderboardMorning(promotionId);
  return getCachedLeaderboardNight(promotionId);
}
