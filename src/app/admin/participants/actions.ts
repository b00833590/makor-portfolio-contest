"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { createParticipantWithTempPassword } from "@/lib/participants/create-participant";
import { createParticipantSchema, resetPasswordSchema, reassignPromotionSchema } from "./schema";

export interface ParticipantFormState {
  error?: string;
  created?: { name: string; email?: string; tempPassword: string };
}

export async function createParticipant(
  _prevState: ParticipantFormState,
  formData: FormData,
): Promise<ParticipantFormState> {
  const session = await requireAdmin();

  const parsed = createParticipantSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    promotionId: formData.get("promotionId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { name, email, promotionId } = parsed.data;

  const result = await createParticipantWithTempPassword({ name, promotionId });
  if (result.status === "exists") {
    return { error: `L'identifiant "${name}" est déjà utilisé.` };
  }

  await logAudit({
    adminId: session.user.id,
    action: "participant.create",
    target: name,
    after: { name, promotionId },
  });

  revalidatePath("/admin/participants");
  return { created: { name, email: email || undefined, tempPassword: result.tempPassword } };
}

export async function resetParticipantPassword(
  _prevState: ParticipantFormState,
  formData: FormData,
): Promise<ParticipantFormState> {
  const session = await requireAdmin();

  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await db.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash, mustChangePassword: true },
  });

  await logAudit({
    adminId: session.user.id,
    action: "participant.reset-password",
    target: parsed.data.userId,
  });

  revalidatePath("/admin/participants");
  return { created: { name: user.name, tempPassword } };
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
