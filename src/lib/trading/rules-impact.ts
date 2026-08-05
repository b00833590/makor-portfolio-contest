import type { AssetType } from "@/generated/prisma/enums";
import type { PromotionRules } from "@/lib/promotion-rules";

export interface PortfolioPosition {
  symbol: string;
  assetType: AssetType;
  quantity: number;
  currentPrice: number;
}

export interface PortfolioImpactSnapshot {
  participantName: string;
  positions: PortfolioPosition[];
}

export interface RuleImpactWarning {
  field: keyof PromotionRules | "endDate";
  summary: string;
  details: string[];
}

const MAX_LISTED_DETAILS = 5;

function summarizeNames(names: string[]): string {
  if (names.length <= MAX_LISTED_DETAILS) return names.join(", ");
  return `${names.slice(0, MAX_LISTED_DETAILS).join(", ")}, et ${names.length - MAX_LISTED_DETAILS} autre(s)`;
}

/**
 * Compare les règles proposées à l'état réel actuel des portefeuilles pour
 * détecter les incohérences qu'un changement de règle créerait — ex. baisser
 * le nombre max de cryptomonnaies alors que des participants en détiennent
 * déjà plus. Ne bloque rien : les positions déjà ouvertes ne sont jamais
 * vendues automatiquement (l'admin doit rester en contrôle), l'avertissement
 * sert juste à ce que ce ne soit jamais une surprise. Pure et testable sans
 * base de données — la récupération des portefeuilles est à la charge de
 * l'appelant (voir actions.ts).
 */
export function analyzeRulesImpact(
  newRules: PromotionRules,
  portfolios: PortfolioImpactSnapshot[],
): RuleImpactWarning[] {
  const warnings: RuleImpactWarning[] = [];

  const cryptoOverLimit = portfolios.filter(
    (p) => p.positions.filter((position) => position.assetType === "CRYPTO").length > newRules.maxCryptoPositions,
  );
  if (cryptoOverLimit.length > 0) {
    warnings.push({
      field: "maxCryptoPositions",
      summary: `${cryptoOverLimit.length} participant(s) détiennent déjà plus de ${newRules.maxCryptoPositions} cryptomonnaie(s) que la nouvelle limite ne l'autorise.`,
      details: [
        `Concerné(s) : ${summarizeNames(cryptoOverLimit.map((p) => p.participantName))}.`,
        "Leurs positions actuelles ne seront pas vendues automatiquement, mais ils ne pourront plus en acheter de nouvelles tant qu'ils ne repasseront pas sous la limite.",
      ],
    });
  }

  const positionsOverLimit = portfolios.filter((p) => p.positions.length > newRules.maxPositions);
  if (positionsOverLimit.length > 0) {
    warnings.push({
      field: "maxPositions",
      summary: `${positionsOverLimit.length} participant(s) détiennent déjà plus de ${newRules.maxPositions} positions que la nouvelle limite ne l'autorise.`,
      details: [
        `Concerné(s) : ${summarizeNames(positionsOverLimit.map((p) => p.participantName))}.`,
        "Leurs positions actuelles ne seront pas vendues automatiquement, mais ils ne pourront plus en ouvrir de nouvelles tant qu'ils ne repasseront pas sous la limite.",
      ],
    });
  }

  const undersized: string[] = [];
  const oversized: string[] = [];
  for (const portfolio of portfolios) {
    for (const position of portfolio.positions) {
      const value = position.quantity * position.currentPrice;
      const label = `${portfolio.participantName} — ${position.symbol}`;
      if (value < newRules.minPositionSize) undersized.push(label);
      if (value > newRules.maxPositionSize) oversized.push(label);
    }
  }

  if (undersized.length > 0) {
    warnings.push({
      field: "minPositionSize",
      summary: `${undersized.length} position(s) ouverte(s) valent déjà moins que la nouvelle taille minimale.`,
      details: [`Concerné(s) : ${summarizeNames(undersized)}.`, "Ces positions ne seront pas modifiées automatiquement."],
    });
  }
  if (oversized.length > 0) {
    warnings.push({
      field: "maxPositionSize",
      summary: `${oversized.length} position(s) ouverte(s) valent déjà plus que la nouvelle taille maximale.`,
      details: [`Concerné(s) : ${summarizeNames(oversized)}.`, "Ces positions ne seront pas modifiées automatiquement."],
    });
  }

  return warnings;
}

export interface ChangeSessionSummary {
  weekNumber: number;
  closesAt: Date;
}

/**
 * Même logique d'avertissement que {@link analyzeRulesImpact}, mais pour la
 * date de fin (et le gel qui en dépend) plutôt que les règles numériques —
 * séparé parce que ça compare des dates à un historique de sessions, pas des
 * règles à des portefeuilles. Trois risques distincts, chacun réel :
 * - une session de changement déjà planifiée qui déborderait de la nouvelle
 *   date de fin (jamais ajustée automatiquement — l'admin doit le faire) ;
 * - un changement qui déclenche le gel des positions immédiatement (la
 *   fenêtre de gel dépend à la fois de la date de fin et de sa propre durée
 *   configurable, donc les deux peuvent la faire basculer) ;
 * - une nouvelle date de fin déjà passée.
 */
export function analyzeEndDateImpact(params: {
  newEndDate: Date;
  currentEndDate: Date;
  newFreezeHoursBeforeEnd: number;
  currentFreezeHoursBeforeEnd: number;
  now: Date;
  changeSessions: ChangeSessionSummary[];
}): RuleImpactWarning[] {
  const { newEndDate, currentEndDate, newFreezeHoursBeforeEnd, currentFreezeHoursBeforeEnd, now, changeSessions } = params;
  const warnings: RuleImpactWarning[] = [];

  const dateUnchanged = newEndDate.getTime() === currentEndDate.getTime();
  const freezeUnchanged = newFreezeHoursBeforeEnd === currentFreezeHoursBeforeEnd;
  if (dateUnchanged && freezeUnchanged) return warnings;

  if (!dateUnchanged) {
    const overrunSessions = changeSessions.filter((session) => session.closesAt.getTime() > newEndDate.getTime());
    if (overrunSessions.length > 0) {
      warnings.push({
        field: "endDate",
        summary: `${overrunSessions.length} session(s) de changement déjà planifiée(s) se terminent après la nouvelle date de fin.`,
        details: [
          `Concernée(s) : semaine(s) ${summarizeNames(overrunSessions.map((s) => String(s.weekNumber)))}.`,
          "Elles ne sont pas ajustées automatiquement — raccourcissez-les manuellement depuis la page de la promotion si nécessaire.",
        ],
      });
    }

    if (newEndDate.getTime() <= now.getTime()) {
      warnings.push({
        field: "endDate",
        summary: "La nouvelle date de fin est déjà passée.",
        details: ["Le concours sera considéré comme figé dès l'enregistrement de ce changement."],
      });
    }
  }

  const wasFrozen = now.getTime() >= currentEndDate.getTime() - currentFreezeHoursBeforeEnd * 60 * 60 * 1000;
  const willBeFrozen = now.getTime() >= newEndDate.getTime() - newFreezeHoursBeforeEnd * 60 * 60 * 1000;
  if (!wasFrozen && willBeFrozen) {
    warnings.push({
      field: "endDate",
      summary: "Ce changement déclenche immédiatement le gel des positions.",
      details: [
        `Avec un gel de ${newFreezeHoursBeforeEnd}h avant la fin, plus aucun changement ne sera possible pour les participants dès l'enregistrement.`,
      ],
    });
  }

  return warnings;
}
