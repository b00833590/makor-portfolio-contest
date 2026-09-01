import "server-only";
import { db } from "@/lib/db";
import { ChangeSessionKind, ChangeSessionStatus } from "@/generated/prisma/enums";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { ensureBadgesSeeded } from "./evaluate-badges";
import { getLeaderboard, type LeaderboardRow } from "./get-leaderboard";
import { buildTrades } from "./match-closing-trades";
import { computeMaxPostBuyGainPct } from "./badges/post-buy-gain";

const MAX_LOSS_PCT_THRESHOLD = -10;
const MIN_TRADES_FOR_MEILLEUR_TRADER = 5;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export interface CloseOnlySummary {
  userId: string;
  finalRank: number;
  usedWindowEveryWeek: boolean;
  neverExceededMaxLossPct: boolean;
  wasEverLastAndFinishedTopThree: boolean;
  heldPositionEntireContest: boolean;
  /** Meilleur pnl % sur un trade (ouvert ou clôturé), null si aucune position n'a jamais été prise. */
  bestTradePnlPct: number | null;
  /** Taux de réussite sur les trades clôturés, null si moins de 5 trades clôturés. */
  winRatePct: number | null;
  bestPostBuyGainPct: number | null;
}

/**
 * Détermine les gagnants des 8 badges close-only à partir d'un résumé par participant — pur,
 * testable par fixtures. Certains badges (STRATEGE_ASSIDU, SANS_FAUTE, LE_PHENIX,
 * FIDELE_AU_POSTE) peuvent avoir plusieurs gagnants ; les superlatifs (CHAMPION_DU_CONCOURS,
 * MEILLEUR_STOCK_PICKER, MEILLEUR_TRADER, MEILLEUR_TIMING) vont à quiconque égale le meilleur
 * score (ex-aequo inclus).
 */
export function computeCloseOnlyWinners(summaries: CloseOnlySummary[]): { userId: string; code: string }[] {
  const winners: { userId: string; code: string }[] = [];

  for (const summary of summaries) {
    if (summary.usedWindowEveryWeek) winners.push({ userId: summary.userId, code: "STRATEGE_ASSIDU" });
    if (summary.neverExceededMaxLossPct) winners.push({ userId: summary.userId, code: "SANS_FAUTE" });
    if (summary.wasEverLastAndFinishedTopThree) winners.push({ userId: summary.userId, code: "LE_PHENIX" });
    if (summary.heldPositionEntireContest) winners.push({ userId: summary.userId, code: "FIDELE_AU_POSTE" });
    if (summary.finalRank === 1) winners.push({ userId: summary.userId, code: "CHAMPION_DU_CONCOURS" });
  }

  pushBestOf(summaries, (s) => s.bestTradePnlPct, "MEILLEUR_STOCK_PICKER", winners);
  pushBestOf(
    summaries.filter((s) => s.winRatePct !== null),
    (s) => s.winRatePct,
    "MEILLEUR_TACTICIEN",
    winners,
  );
  pushBestOf(summaries, (s) => s.bestPostBuyGainPct, "OEIL_DE_LYNX", winners);

  return winners;
}

function pushBestOf(
  summaries: CloseOnlySummary[],
  getValue: (summary: CloseOnlySummary) => number | null,
  code: string,
  winners: { userId: string; code: string }[],
): void {
  let best: number | null = null;
  for (const summary of summaries) {
    const value = getValue(summary);
    if (value === null) continue;
    if (best === null || value > best) best = value;
  }
  if (best === null) return;
  for (const summary of summaries) {
    if (getValue(summary) === best) winners.push({ userId: summary.userId, code });
  }
}

async function worstDrawdownPct(
  assetId: string,
  avgEntryPrice: number,
  windowStart: Date,
  windowEnd: Date,
): Promise<number> {
  if (avgEntryPrice <= 0) return 0;
  const priceRows = await db.price.findMany({
    where: { assetId, timestamp: { gte: windowStart, lte: windowEnd } },
    select: { price: true },
  });
  if (priceRows.length === 0) return 0;
  const minPrice = Math.min(...priceRows.map((row) => Number(row.price)));
  return ((minPrice - avgEntryPrice) / avgEntryPrice) * 100;
}

async function buildCloseOnlySummary(
  row: LeaderboardRow,
  promotionId: string,
  promotionStartDate: Date,
  initializationCutoff: Date,
  leaderboard: LeaderboardRow[],
  now: Date,
): Promise<CloseOnlySummary> {
  const [allPositions, transactions, snapshots, closedWeeklySessions] = await Promise.all([
    db.position.findMany({
      where: { portfolioId: row.portfolioId },
      include: { asset: { select: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
    }),
    db.transaction.findMany({
      where: { portfolioId: row.portfolioId },
      select: { assetId: true, type: true, price: true, quantity: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.performanceSnapshot.findMany({ where: { portfolioId: row.portfolioId }, orderBy: { timestamp: "desc" } }),
    db.changeSession.findMany({
      where: { promotionId, kind: ChangeSessionKind.WEEKLY, status: ChangeSessionStatus.CLOSED },
      include: { usages: { where: { userId: row.userId } } },
    }),
  ]);

  const currentPriceByAsset = new Map(
    allPositions.map((position) => [position.assetId, Number(position.asset.prices[0]?.price ?? position.avgEntryPrice)]),
  );
  const trades = buildTrades(
    allPositions.map((position) => ({
      id: position.id,
      assetId: position.assetId,
      avgEntryPrice: Number(position.avgEntryPrice),
      quantity: Number(position.quantity),
      openedAt: position.openedAt,
      closedAt: position.closedAt,
    })),
    transactions.map((t) => ({
      assetId: t.assetId,
      type: t.type,
      price: Number(t.price),
      quantity: Number(t.quantity),
      createdAt: t.createdAt,
    })),
    currentPriceByAsset,
  );

  const bestTradePnlPct = trades.length > 0 ? Math.max(...trades.map((t) => t.pnlPct)) : null;
  const closedTrades = trades.filter((t) => !t.isOpen);
  const winRatePct =
    closedTrades.length >= MIN_TRADES_FOR_MEILLEUR_TRADER
      ? (closedTrades.filter((t) => t.pnlEur >= 0).length / closedTrades.length) * 100
      : null;

  const drawdowns = await Promise.all(
    allPositions.map((position) =>
      worstDrawdownPct(
        position.assetId,
        Number(position.avgEntryPrice),
        position.openedAt,
        position.closedAt ?? now,
      ),
    ),
  );
  const neverExceededMaxLossPct =
    allPositions.length > 0 && drawdowns.every((drawdown) => drawdown >= MAX_LOSS_PCT_THRESHOLD);

  const rankHistory = snapshots.map((snapshot) => snapshot.rank);
  const wasEverLastAndFinishedTopThree =
    row.rank <= 3 && leaderboard.length > 1 && rankHistory.includes(leaderboard.length);

  const heldPositionEntireContest = allPositions.some(
    (position) => position.closedAt === null && position.openedAt <= initializationCutoff,
  );

  const usedWindowEveryWeek =
    closedWeeklySessions.length > 0 &&
    closedWeeklySessions.every((session) => (session.usages[0]?.changesUsed ?? 0) > 0);

  const buyTransactions = transactions.filter((t) => t.type === "BUY");
  let bestPostBuyGainPct: number | null = null;
  if (buyTransactions.length > 0) {
    const buyAssetIds = [...new Set(buyTransactions.map((t) => t.assetId))];
    const minDate = new Date(Math.min(...buyTransactions.map((t) => t.createdAt.getTime())));
    const maxDate = new Date(Math.max(...buyTransactions.map((t) => t.createdAt.getTime())) + FIVE_DAYS_MS);
    const priceRows = await db.price.findMany({
      where: { assetId: { in: buyAssetIds }, timestamp: { gte: minDate, lte: maxDate } },
      orderBy: { timestamp: "asc" },
    });
    const priceHistoryByAsset = new Map<string, { price: number; timestamp: Date }[]>();
    for (const priceRow of priceRows) {
      const list = priceHistoryByAsset.get(priceRow.assetId) ?? [];
      list.push({ price: Number(priceRow.price), timestamp: priceRow.timestamp });
      priceHistoryByAsset.set(priceRow.assetId, list);
    }
    bestPostBuyGainPct = computeMaxPostBuyGainPct(
      buyTransactions.map((t) => ({ assetId: t.assetId, price: Number(t.price), createdAt: t.createdAt })),
      priceHistoryByAsset,
    );
  }

  return {
    userId: row.userId,
    finalRank: row.rank,
    usedWindowEveryWeek,
    neverExceededMaxLossPct,
    wasEverLastAndFinishedTopThree,
    heldPositionEntireContest,
    bestTradePnlPct,
    winRatePct,
    bestPostBuyGainPct,
  };
}

/**
 * Calcule et attribue les 8 badges close-only (superlatifs de fin de concours + conditions
 * "tout le concours") — appelé une seule fois au passage ACTIVE → CLOSED d'une promotion (voir
 * src/app/admin/promotions/actions.ts, setPromotionStatus). Ne doit jamais être appelé pour une
 * promotion encore active : ces badges ne peuvent pas être retirés une fois attribués, et
 * seraient prématurés/faux avant la fin réelle du concours.
 */
export async function awardCloseOnlyBadges(
  promotionId: string,
  now: Date = new Date(),
  precomputedLeaderboard?: LeaderboardRow[],
): Promise<{ userId: string; code: string }[]> {
  await ensureBadgesSeeded();

  const [leaderboard, promotion] = await Promise.all([
    precomputedLeaderboard ?? getLeaderboard(promotionId, now),
    db.promotion.findUniqueOrThrow({ where: { id: promotionId } }),
  ]);
  if (leaderboard.length === 0) return [];

  const initializationWindowHours = promotionRulesSchema.parse(promotion.rules).initializationWindowHours;
  const initializationCutoff = new Date(
    promotion.startDate.getTime() + initializationWindowHours * 60 * 60 * 1000,
  );

  const summaries = await Promise.all(
    leaderboard.map((row) =>
      buildCloseOnlySummary(row, promotionId, promotion.startDate, initializationCutoff, leaderboard, now),
    ),
  );

  const winners = computeCloseOnlyWinners(summaries);
  if (winners.length === 0) return [];

  const badgeRows = await db.badge.findMany({ where: { code: { in: [...new Set(winners.map((w) => w.code))] } } });
  const badgeIdByCode = new Map(badgeRows.map((badge) => [badge.code, badge.id]));

  for (const winner of winners) {
    const badgeId = badgeIdByCode.get(winner.code);
    if (!badgeId) continue;
    await db.userBadge.upsert({
      where: { userId_badgeId_promotionId: { userId: winner.userId, badgeId, promotionId } },
      update: {},
      create: { userId: winner.userId, badgeId, promotionId },
    });
  }

  return winners;
}
