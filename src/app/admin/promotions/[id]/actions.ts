"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ChangeSessionStatus } from "@/generated/prisma/enums";
import { recalculateAllPortfolioSnapshots } from "@/lib/trading/recalculate-snapshot";
import { createChangeSessionSchema, updateRulesTextSchema } from "./schema";

export interface ChangeSessionFormState {
  error?: string;
}

export async function createChangeSession(
  promotionId: string,
  _prevState: ChangeSessionFormState,
  formData: FormData,
): Promise<ChangeSessionFormState> {
  const session = await requireAdmin();

  const parsed = createChangeSessionSchema.safeParse({
    weekNumber: formData.get("weekNumber"),
    opensAt: formData.get("opensAt"),
    closesAt: formData.get("closesAt"),
    maxChangesPerParticipant: formData.get("maxChangesPerParticipant"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const changeSession = await db.changeSession.create({
    data: { promotionId, ...parsed.data },
  });

  await logAudit({
    adminId: session.user.id,
    action: "change-session.create",
    target: changeSession.id,
    after: parsed.data,
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  return {};
}

export async function updateChangeSession(
  promotionId: string,
  changeSessionId: string,
  _prevState: ChangeSessionFormState,
  formData: FormData,
): Promise<ChangeSessionFormState> {
  const session = await requireAdmin();

  const parsed = createChangeSessionSchema.safeParse({
    weekNumber: formData.get("weekNumber"),
    opensAt: formData.get("opensAt"),
    closesAt: formData.get("closesAt"),
    maxChangesPerParticipant: formData.get("maxChangesPerParticipant"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const before = await db.changeSession.findUniqueOrThrow({ where: { id: changeSessionId } });
  await db.changeSession.update({
    where: { id: changeSessionId },
    data: parsed.data,
  });

  await logAudit({
    adminId: session.user.id,
    action: "change-session.update",
    target: changeSessionId,
    before: {
      weekNumber: before.weekNumber,
      opensAt: before.opensAt,
      closesAt: before.closesAt,
      maxChangesPerParticipant: before.maxChangesPerParticipant,
    },
    after: parsed.data,
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  return {};
}

export async function deleteChangeSession(promotionId: string, changeSessionId: string) {
  const session = await requireAdmin();

  const before = await db.changeSession.findUniqueOrThrow({ where: { id: changeSessionId } });
  await db.changeSession.delete({ where: { id: changeSessionId } });

  await logAudit({
    adminId: session.user.id,
    action: "change-session.delete",
    target: changeSessionId,
    before: { weekNumber: before.weekNumber, status: before.status },
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
}

export async function setChangeSessionStatus(
  promotionId: string,
  changeSessionId: string,
  status: ChangeSessionStatus,
) {
  const session = await requireAdmin();

  const before = await db.changeSession.findUniqueOrThrow({ where: { id: changeSessionId } });
  const changeSession = await db.changeSession.update({
    where: { id: changeSessionId },
    data: { status },
  });

  await logAudit({
    adminId: session.user.id,
    action: "change-session.status",
    target: changeSessionId,
    before: { status: before.status },
    after: { status: changeSession.status },
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
}

export interface RulesTextFormState {
  error?: string;
}

export async function updatePromotionRulesText(
  promotionId: string,
  _prevState: RulesTextFormState,
  formData: FormData,
): Promise<RulesTextFormState> {
  const session = await requireAdmin();

  const parsed = updateRulesTextSchema.safeParse({
    rulesIntro: formData.get("rulesIntro"),
    rulesCustomNotes: formData.get("rulesCustomNotes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const rulesIntro = parsed.data.rulesIntro || null;
  const rulesCustomNotes = parsed.data.rulesCustomNotes || null;

  const before = await db.promotion.findUniqueOrThrow({
    where: { id: promotionId },
    select: { rulesIntro: true, rulesCustomNotes: true },
  });
  await db.promotion.update({
    where: { id: promotionId },
    data: { rulesIntro, rulesCustomNotes },
  });

  await logAudit({
    adminId: session.user.id,
    action: "promotion.rules_update",
    target: promotionId,
    before,
    after: { rulesIntro, rulesCustomNotes },
  });

  revalidatePath(`/admin/promotions/${promotionId}/reglement`);
  revalidatePath("/reglement");
  return {};
}

export async function recalculateAllSnapshots(promotionId: string) {
  const session = await requireAdmin();

  await recalculateAllPortfolioSnapshots(promotionId);

  await logAudit({
    adminId: session.user.id,
    action: "promotion.recalculate",
    target: promotionId,
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
}
