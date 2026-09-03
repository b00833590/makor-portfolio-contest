"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { createParticipantWithTempPassword } from "@/lib/participants/create-participant";
import { registerParticipants } from "@/lib/participants/promotion-membership";
import { createParticipantSchema, resetPasswordSchema, addToPromotionSchema } from "./schema";

export interface ParticipantFormState {
  error?: string;
  created?: { name: string; tempPassword: string };
}

export async function createParticipant(
  _prevState: ParticipantFormState,
  formData: FormData,
): Promise<ParticipantFormState> {
  const session = await requireAdmin();

  const parsed = createParticipantSchema.safeParse({
    name: formData.get("name"),
    promotionId: formData.get("promotionId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { name, promotionId } = parsed.data;

  const result = await createParticipantWithTempPassword({ name });
  if (result.status === "exists") {
    return { error: `L'identifiant "${name}" est déjà utilisé.` };
  }

  await registerParticipants(promotionId, [result.id]);

  await logAudit({
    adminId: session.user.id,
    action: "participant.create",
    target: name,
    after: { name, promotionId },
  });

  revalidatePath("/admin/participants");
  return { created: { name, tempPassword: result.tempPassword } };
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
  await destroyAllSessionsForUser(parsed.data.userId);

  await logAudit({
    adminId: session.user.id,
    action: "participant.reset-password",
    target: parsed.data.userId,
  });

  revalidatePath("/admin/participants");
  return { created: { name: user.name, tempPassword } };
}

export async function addParticipantToPromotion(
  _prevState: ParticipantFormState,
  formData: FormData,
): Promise<ParticipantFormState> {
  const session = await requireAdmin();

  const parsed = addToPromotionSchema.safeParse({
    userId: formData.get("userId"),
    promotionId: formData.get("promotionId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const [result] = await registerParticipants(parsed.data.promotionId, [parsed.data.userId]);
  if (!result) {
    return { error: "Participant introuvable." };
  }
  if (result.status === "blocked-active-elsewhere") {
    return { error: `${result.name} participe déjà à « ${result.promotionName} » (promotion active).` };
  }

  await logAudit({
    adminId: session.user.id,
    action: "participant.add-to-promotion",
    target: parsed.data.userId,
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
