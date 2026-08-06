"use server";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { markBadgesSeen } from "./evaluate-badges";

/** Marque des badges comme vus pour l'utilisateur courant — appelé par UnseenBadgeToaster juste
 * après avoir affiché leur toast de déblocage, pour qu'ils ne soient plus jamais renvoyés par
 * getUnseenBadges. */
export async function acknowledgeBadges(codes: string[]): Promise<void> {
  if (codes.length === 0) return;
  const session = await verifySession();
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { promotionId: true } });
  if (!user?.promotionId) return;
  await markBadgesSeen(session.user.id, user.promotionId, codes);
}
