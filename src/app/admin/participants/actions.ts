"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { addParticipantSchema } from "./schema";

export interface ParticipantFormState {
  error?: string;
}

export async function addParticipant(
  _prevState: ParticipantFormState,
  formData: FormData,
): Promise<ParticipantFormState> {
  const session = await requireAdmin();

  const parsed = addParticipantSchema.safeParse({
    email: formData.get("email"),
    promotionId: formData.get("promotionId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { email, promotionId } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: { promotionId },
      })
    : await db.user.create({
        data: { email: normalizedEmail, promotionId },
      });

  await logAudit({
    adminId: session.user.id,
    action: existing ? "participant.reassign" : "participant.invite",
    target: user.id,
    before: existing ? { promotionId: existing.promotionId } : undefined,
    after: { email: normalizedEmail, promotionId },
  });

  revalidatePath("/admin/participants");
  return {};
}

export async function removeParticipant(userId: string) {
  const session = await requireAdmin();

  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({
    where: { id: userId },
    data: { promotionId: null },
  });

  await logAudit({
    adminId: session.user.id,
    action: "participant.remove",
    target: userId,
    before: { promotionId: before.promotionId },
    after: { promotionId: null },
  });

  revalidatePath("/admin/participants");
}
