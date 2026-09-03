import "server-only";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { provisionPortfolioIfPromotionActive } from "@/lib/portfolio-provisioning";

export type RegisterResult =
  | { userId: string; name: string; status: "registered" }
  | { userId: string; name: string; status: "already-registered" }
  | { userId: string; name: string; status: "blocked-active-elsewhere"; promotionName: string };

/**
 * Inscrit un ou plusieurs participants à une promotion : crée la ligne
 * PromotionParticipant (idempotent via la contrainte unique) et synchronise le
 * pointeur User.promotionId. Provisionne les portefeuilles une seule fois à la
 * fin si la promotion est déjà ACTIVE. Refuse d'inscrire un participant dont la
 * promotion actuelle est ACTIVE et différente (perte d'accès à un concours en
 * cours) — le client garantit qu'une seule promotion tourne à la fois, ce
 * garde-fou couvre le cas anormal.
 *
 * Un participant déjà inscrit (ligne de liaison présente) mais dont le pointeur
 * a été détaché (ex. « Retirer » depuis /admin/participants) est re-synchronisé
 * ici : sans ça il resterait sans tableau de bord ni classement, sans moyen de
 * le récupérer depuis l'admin.
 */
export async function registerParticipants(
  promotionId: string,
  userIds: string[],
): Promise<RegisterResult[]> {
  const results: RegisterResult[] = [];
  // Dédoublonne : deux fois le même id enchaînerait un create sur la contrainte
  // unique (la ligne créée au 1er passage n'est pas visible du findUnique du 2e).
  const uniqueUserIds = [...new Set(userIds)];
  let anyMembership = false;

  for (const userId of uniqueUserIds) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        promotionId: true,
        promotion: { select: { status: true, name: true } },
      },
    });
    if (!user) continue;

    if (
      user.promotionId &&
      user.promotionId !== promotionId &&
      user.promotion?.status === PromotionStatus.ACTIVE
    ) {
      results.push({
        userId,
        name: user.name,
        status: "blocked-active-elsewhere",
        promotionName: user.promotion.name,
      });
      continue;
    }

    const existing = await db.promotionParticipant.findUnique({
      where: { userId_promotionId: { userId, promotionId } },
    });
    if (existing) {
      if (user.promotionId !== promotionId) {
        await db.user.update({ where: { id: userId }, data: { promotionId } });
      }
      anyMembership = true;
      results.push({ userId, name: user.name, status: "already-registered" });
      continue;
    }

    await db.promotionParticipant.create({ data: { userId, promotionId } });
    await db.user.update({ where: { id: userId }, data: { promotionId } });
    anyMembership = true;
    results.push({ userId, name: user.name, status: "registered" });
  }

  // Idempotent (skipDuplicates) : sans danger de le lancer aussi pour les
  // "already-registered" — couvre le cas d'un portefeuille jamais créé.
  if (anyMembership) {
    await provisionPortfolioIfPromotionActive(promotionId);
  }

  return results;
}

/**
 * Retire un participant d'une promotion — autorisé uniquement tant que la
 * promotion est DRAFT (aucun portefeuille créé). Retirer quelqu'un d'une
 * promotion active ou clôturée fausserait classement et historique.
 */
export async function unregisterParticipant(promotionId: string, userId: string): Promise<void> {
  const promotion = await db.promotion.findUniqueOrThrow({
    where: { id: promotionId },
    select: { status: true },
  });
  if (promotion.status !== PromotionStatus.DRAFT) {
    throw new Error("Retirer un participant n'est possible que sur une promotion en brouillon.");
  }

  await db.promotionParticipant.deleteMany({ where: { userId, promotionId } });

  const user = await db.user.findUnique({ where: { id: userId }, select: { promotionId: true } });
  if (user?.promotionId === promotionId) {
    await db.user.update({ where: { id: userId }, data: { promotionId: null } });
  }
}
