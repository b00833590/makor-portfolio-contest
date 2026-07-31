export type BadgeCode = "DIVERSIFICATEUR" | "SNIPER" | "MAIN_DE_FER" | "COMEBACK";

export interface BadgePositionContext {
  marketValue: number;
  costBasis: number;
}

export interface BadgeEvaluationContext {
  now: Date;
  /** Somme des valeurs de marché des positions ouvertes — n'inclut PAS le cash non investi. */
  investedValue: number;
  positions: BadgePositionContext[];
  lastTransactionDate: Date | null;
  cumulativeReturnPct: number;
  currentRank: number | null;
  previousRank: number | null;
}

const MAX_SINGLE_POSITION_SHARE_PCT = 20;
const SNIPER_GAIN_THRESHOLD_PCT = 30;
const MAIN_DE_FER_MIN_DAYS = 14;
const COMEBACK_MIN_RANK_GAIN = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function isDiversificateur(ctx: BadgeEvaluationContext): boolean {
  if (ctx.positions.length === 0 || ctx.investedValue <= 0) return false;
  return ctx.positions.every(
    (position) => (position.marketValue / ctx.investedValue) * 100 <= MAX_SINGLE_POSITION_SHARE_PCT,
  );
}

function isSniper(ctx: BadgeEvaluationContext): boolean {
  return ctx.positions.some((position) => {
    if (position.costBasis <= 0) return false;
    const gainPct = ((position.marketValue - position.costBasis) / position.costBasis) * 100;
    return gainPct >= SNIPER_GAIN_THRESHOLD_PCT;
  });
}

function isMainDeFer(ctx: BadgeEvaluationContext): boolean {
  if (!ctx.lastTransactionDate || ctx.cumulativeReturnPct <= 0) return false;
  const daysSinceLastTransaction = (ctx.now.getTime() - ctx.lastTransactionDate.getTime()) / DAY_MS;
  return daysSinceLastTransaction >= MAIN_DE_FER_MIN_DAYS;
}

function isComeback(ctx: BadgeEvaluationContext): boolean {
  if (ctx.currentRank === null || ctx.previousRank === null) return false;
  return ctx.previousRank - ctx.currentRank >= COMEBACK_MIN_RANK_GAIN;
}

export function evaluateBadgeCriteria(ctx: BadgeEvaluationContext): BadgeCode[] {
  const earned: BadgeCode[] = [];
  if (isDiversificateur(ctx)) earned.push("DIVERSIFICATEUR");
  if (isSniper(ctx)) earned.push("SNIPER");
  if (isMainDeFer(ctx)) earned.push("MAIN_DE_FER");
  if (isComeback(ctx)) earned.push("COMEBACK");
  return earned;
}
