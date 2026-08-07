import "server-only";
import { db } from "@/lib/db";
import { ChangeSessionKind } from "@/generated/prisma/enums";
import { promotionRulesSchema } from "@/lib/promotion-rules";

/**
 * Ouvre automatiquement la fenêtre de constitution du portefeuille initial au
 * lancement d'une promotion (passage à ACTIVE) — semaine 0, changements
 * illimités (voir rules-engine.ts). Idempotent : ne crée rien si une fenêtre
 * d'initialisation existe déjà pour cette promotion (réactivation après clôture).
 * `status` reste au défaut SCHEDULED : comme `opensAt = now`, elle est
 * immédiatement considérée ouverte par computeChangeSessionStatus, sans avoir
 * besoin de forcer status=OPEN à la création.
 */
export async function ensureInitializationWindow(promotionId: string, now: Date = new Date()) {
  const existing = await db.changeSession.findFirst({
    where: { promotionId, kind: ChangeSessionKind.INITIALIZATION },
    select: { id: true },
  });
  if (existing) {
    return null;
  }

  const promotion = await db.promotion.findUniqueOrThrow({ where: { id: promotionId } });
  const rules = promotionRulesSchema.parse(promotion.rules);
  const closesAt = new Date(now.getTime() + rules.initializationWindowHours * 60 * 60 * 1000);

  return db.changeSession.create({
    data: {
      promotionId,
      kind: ChangeSessionKind.INITIALIZATION,
      weekNumber: 0,
      opensAt: now,
      closesAt,
      maxChangesPerParticipant: rules.maxChangesPerSession,
    },
  });
}
