"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { createParticipantSchema, resetPasswordSchema, reassignPromotionSchema } from "./schema";

export interface ParticipantFormState {
  error?: string;
}

export async function createParticipant(
  _prevState: ParticipantFormState,
  formData: FormData,
): Promise<ParticipantFormState> {
  const session = await requireAdmin();

  const parsed = createParticipantSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
    promotionId: formData.get("promotionId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { name, password, promotionId } = parsed.data;

  const existing = await db.user.findUnique({ where: { name } });
  if (existing) {
    return { error: `L'identifiant "${name}" est déjà utilisé.` };
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { name, passwordHash, promotionId } });

  await logAudit({
    adminId: session.user.id,
    action: "participant.create",
    target: user.id,
    after: { name, promotionId },
  });

  revalidatePath("/admin/participants");
  return {};
}

export async function resetParticipantPassword(
  _prevState: ParticipantFormState,
  formData: FormData,
): Promise<ParticipantFormState> {
  const session = await requireAdmin();

  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.user.update({ where: { id: parsed.data.userId }, data: { passwordHash } });

  await logAudit({
    adminId: session.user.id,
    action: "participant.reset-password",
    target: parsed.data.userId,
  });

  revalidatePath("/admin/participants");
  return {};
}

export async function reassignParticipantPromotion(
  _prevState: ParticipantFormState,
  formData: FormData,
): Promise<ParticipantFormState> {
  const session = await requireAdmin();

  const parsed = reassignPromotionSchema.safeParse({
    userId: formData.get("userId"),
    promotionId: formData.get("promotionId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const before = await db.user.findUniqueOrThrow({ where: { id: parsed.data.userId } });
  await db.user.update({
    where: { id: parsed.data.userId },
    data: { promotionId: parsed.data.promotionId },
  });

  await logAudit({
    adminId: session.user.id,
    action: "participant.reassign",
    target: parsed.data.userId,
    before: { promotionId: before.promotionId },
    after: { promotionId: parsed.data.promotionId },
  });

  revalidatePath("/admin/participants");
  return {};
}

export async function removeParticipant(userId: string) {
  const session = await requireAdmin();

  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({ where: { id: userId }, data: { promotionId: null } });

  await logAudit({
    adminId: session.user.id,
    action: "participant.remove",
    target: userId,
    before: { promotionId: before.promotionId },
    after: { promotionId: null },
  });

  revalidatePath("/admin/participants");
}

export async function deleteParticipant(userId: string) {
  const session = await requireAdmin();

  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.delete({ where: { id: userId } });

  await logAudit({
    adminId: session.user.id,
    action: "participant.delete",
    target: userId,
    before: { name: before.name },
  });

  revalidatePath("/admin/participants");
}
