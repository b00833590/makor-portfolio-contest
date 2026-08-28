import "server-only";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { PromotionStatus, ChangeSessionStatus } from "@/generated/prisma/enums";
import { getLeaderboard } from "@/lib/gamification/get-leaderboard";
import { awardCloseOnlyBadges } from "@/lib/gamification/award-close-only-badges";

/**
 * Clôt une promotion si sa date+heure de fin est atteinte. Idempotent et
 * sûr en concurrence : la transition ACTIVE → CLOSED est un `updateMany`
 * conditionnel unique — `count` (0 ou 1) indique si CET appel a réalisé la
 * transition. Seul l'appel gagnant lance la finalisation. Un appel
 * ultérieur (ou concurrent perdant) voit `count: 0` et ne touche à rien.
 */
export async function closePromotionIfEnded(
  promotionId: string,
  now: Date = new Date(),
): Promise<{ closed: boolean }> {
  const { count } = await db.promotion.updateMany({
    where: { id: promotionId, status: PromotionStatus.ACTIVE, endDate: { lte: now } },
    data: { status: PromotionStatus.CLOSED },
  });
  if (count === 0) return { closed: false };

  await finalizePromotionClosure(promotionId);
  return { closed: true };
}

/**
 * Écrit le résultat officiel définitif d'une promotion clôturée. Rejouable
 * sans effet : chaque étape est idempotente (updateMany no-op,
 * `createMany({ skipDuplicates: true })`, awardCloseOnlyBadges upsert) et
 * sûre en concurrence — deux finalisations simultanées (clôture paresseuse +
 * self-heal de /resultats) ne se marchent pas dessus. Horodaté à
 * `min(endDate, now)` : pour la clôture automatique `endDate <= now`, donc
 * `asOf === endDate` (déterministe) ; seule une clôture anticipée par l'admin
 * prend `now`, pour ne pas estampiller une date de fin dans le futur.
 */
export async function finalizePromotionClosure(promotionId: string): Promise<void> {
  const promotion = await db.promotion.findUniqueOrThrow({ where: { id: promotionId } });
  const asOf = new Date(Math.min(promotion.endDate.getTime(), Date.now()));
  const initialCapital = Number(promotion.initialCapital);

  // Ferme toute session de changement encore ouverte (auto ou forcée par l'admin).
  await db.changeSession.updateMany({
    where: { promotionId, status: { not: ChangeSessionStatus.CLOSED } },
    data: { status: ChangeSessionStatus.CLOSED },
  });

  // Classement final, calculé une fois, avec la même logique de rang que
  // partout ailleurs (rankEntries via getLeaderboard).
  const finalRows = await getLeaderboard(promotionId, asOf);

  // Badges de fin de concours (superlatifs + conditions "tout le concours").
  await awardCloseOnlyBadges(promotionId, asOf, finalRows);

  // Historique figé — une entrée par participant, jamais modifiée si elle
  // existe. `createMany({ skipDuplicates: true })` est atomique : un rejeu
  // (ou une finalisation concurrente) est un no-op grâce à la contrainte
  // unique (promotionId, userId).
  await db.hallOfFameEntry.createMany({
    data: finalRows.map((row) => ({
      promotionId,
      userId: row.userId,
      userName: row.name,
      promotionName: promotion.name,
      finalReturnPct: row.cumulativeReturnPct,
      finalPnlEur: row.totalValue - initialCapital,
      finalRank: row.rank,
      closedAt: asOf,
    })),
    skipDuplicates: true,
  });

  // Invalidation best-effort : revalidateTag fonctionne depuis une server
  // action et un route handler, mais lève si finalizePromotionClosure tourne
  // pendant le rendu d'une page (chemin de clôture paresseuse). Les écritures
  // ci-dessus sont déjà committées — une invalidation manquée signifie juste
  // que le classement / Hall of Fame se rafraîchissent à leur fenêtre de
  // revalidation habituelle au lieu d'instantanément.
  try {
    revalidateTag("hall-of-fame", "max");
    revalidateTag("leaderboard", "max");
  } catch {
    // rendu RSC : ignoré volontairement, voir ci-dessus
  }
}

/**
 * Balaie toutes les promotions dont la fin est atteinte mais qui sont
 * encore ACTIVE — filet de sécurité appelé par le cron nocturne. Renvoie
 * les ids effectivement clôturés.
 */
export async function closeEndedPromotions(now: Date = new Date()): Promise<string[]> {
  const candidates = await db.promotion.findMany({
    where: { status: PromotionStatus.ACTIVE, endDate: { lte: now } },
    select: { id: true },
  });
  const closed: string[] = [];
  for (const candidate of candidates) {
    const result = await closePromotionIfEnded(candidate.id, now);
    if (result.closed) closed.push(candidate.id);
  }

  // Filet de sécurité : promotions déjà CLOSED mais dont la finalisation a été
  // interrompue (aucune entrée Hall of Fame). Rejoué sans effet ; ces ids ne
  // sont pas ajoutés au retour — la transition ACTIVE → CLOSED est déjà faite.
  const stuck = await db.promotion.findMany({
    where: {
      status: PromotionStatus.CLOSED,
      endDate: { lte: now },
      hallOfFameEntries: { none: {} },
    },
    select: { id: true },
  });
  for (const promotion of stuck) {
    await finalizePromotionClosure(promotion.id).catch(() => {});
  }

  return closed;
}
