"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { promotionRulesSchema, type PromotionRules } from "@/lib/promotion-rules";
import {
  analyzeRulesImpact,
  analyzeEndDateImpact,
  type RuleImpactWarning,
  type PortfolioImpactSnapshot,
} from "@/lib/trading/rules-impact";
import { promotionSettingsSchema } from "./schema";

export interface PromotionSettingsFormState {
  error?: string;
  warnings?: RuleImpactWarning[];
  saved?: boolean;
}

async function loadPortfolioSnapshots(promotionId: string): Promise<PortfolioImpactSnapshot[]> {
  const positions = await db.position.findMany({
    where: { portfolio: { promotionId }, quantity: { gt: 0 }, closedAt: null },
    include: {
      asset: { include: { prices: { orderBy: { timestamp: "desc" }, take: 1 } } },
      portfolio: { include: { user: { select: { name: true } } } },
    },
  });

  const byPortfolio = new Map<string, PortfolioImpactSnapshot>();
  for (const position of positions) {
    let snapshot = byPortfolio.get(position.portfolioId);
    if (!snapshot) {
      snapshot = { participantName: position.portfolio.user.name, positions: [] };
      byPortfolio.set(position.portfolioId, snapshot);
    }
    snapshot.positions.push({
      symbol: position.asset.symbol,
      assetType: position.asset.type,
      quantity: Number(position.quantity),
      currentPrice: Number(position.asset.prices[0]?.price ?? position.avgEntryPrice),
    });
  }

  return [...byPortfolio.values()];
}

function parseSettingsForm(formData: FormData) {
  return promotionSettingsSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    initialCapital: formData.get("initialCapital"),
    minPositionSize: formData.get("minPositionSize"),
    maxPositionSize: formData.get("maxPositionSize"),
    maxPositions: formData.get("maxPositions"),
    maxCryptoPositions: formData.get("maxCryptoPositions"),
    changeSessionsPerWeek: formData.get("changeSessionsPerWeek"),
    maxChangesPerSession: formData.get("maxChangesPerSession"),
    freezeHoursBeforeEnd: formData.get("freezeHoursBeforeEnd"),
    initializationWindowHours: formData.get("initializationWindowHours"),
  });
}

/**
 * Toutes les règles du jeu — dates, capital, positions, cryptos, sessions —
 * dans un seul endroit (contrairement à l'ancien `updatePromotion`,
 * admin/promotions/actions.ts, qui ne gère plus que le nom). Toujours
 * appliqué immédiatement (aucune règle n'est figée après le lancement),
 * mais en deux temps si le changement crée une incohérence avec l'état réel
 * des portefeuilles ou des sessions déjà planifiées : la première
 * soumission renvoie les avertissements sans rien enregistrer, la seconde
 * (avec confirmation) applique le changement. `initialCapital` est le seul
 * champ bloqué (pas juste averti) dès qu'une transaction existe — au-delà
 * de ce point, le capital de départ n'a plus de sens réconciliable
 * rétroactivement.
 */
export async function updatePromotionSettings(
  promotionId: string,
  _prevState: PromotionSettingsFormState,
  formData: FormData,
): Promise<PromotionSettingsFormState> {
  const session = await requireAdmin();

  const parsed = parseSettingsForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const confirmed = formData.get("confirmed") === "true";
  const { startDate, endDate, initialCapital, ...newRules } = parsed.data;

  const promotion = await db.promotion.findUniqueOrThrow({ where: { id: promotionId } });
  const currentRules = promotionRulesSchema.parse(promotion.rules);
  const currentInitialCapital = Number(promotion.initialCapital);

  if (initialCapital !== currentInitialCapital) {
    const transactionCount = await db.transaction.count({ where: { portfolio: { promotionId } } });
    if (transactionCount > 0) {
      return {
        error:
          "Le capital initial ne peut plus être modifié : des transactions ont déjà été enregistrées pour cette promotion. Le concours a réellement commencé.",
      };
    }
  }

  const [snapshots, changeSessions] = await Promise.all([
    loadPortfolioSnapshots(promotionId),
    db.changeSession.findMany({ where: { promotionId }, select: { weekNumber: true, closesAt: true } }),
  ]);

  const warnings = [
    ...analyzeRulesImpact(newRules, snapshots),
    ...analyzeEndDateImpact({
      newEndDate: endDate,
      currentEndDate: promotion.endDate,
      newFreezeHoursBeforeEnd: newRules.freezeHoursBeforeEnd,
      currentFreezeHoursBeforeEnd: currentRules.freezeHoursBeforeEnd,
      now: new Date(),
      changeSessions,
    }),
  ];

  if (warnings.length > 0 && !confirmed) {
    return { warnings };
  }

  await db.promotion.update({
    where: { id: promotionId },
    data: { startDate, endDate, initialCapital, rules: newRules },
  });

  await logAudit({
    adminId: session.user.id,
    action: "promotion.settings_update",
    target: promotionId,
    before: {
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      initialCapital: currentInitialCapital,
      ...currentRules,
    } satisfies { startDate: Date; endDate: Date; initialCapital: number } & PromotionRules,
    after: { startDate, endDate, initialCapital, ...newRules } satisfies {
      startDate: Date;
      endDate: Date;
      initialCapital: number;
    } & PromotionRules,
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath(`/admin/promotions/${promotionId}/parametres`);
  revalidatePath(`/admin/promotions/${promotionId}/reglement`);
  revalidatePath("/admin/promotions");
  revalidatePath("/reglement");
  revalidatePath("/dashboard");
  return { saved: true };
}
