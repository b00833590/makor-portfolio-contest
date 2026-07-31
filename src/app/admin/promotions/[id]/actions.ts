"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ChangeSessionStatus } from "@/generated/prisma/enums";
import { createChangeSessionSchema } from "./schema";

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
