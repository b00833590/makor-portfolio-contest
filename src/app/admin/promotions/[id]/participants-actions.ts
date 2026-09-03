"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { createParticipantWithTempPassword, type ParticipantCreationResult } from "@/lib/participants/create-participant";
import { registerParticipants, unregisterParticipant, type RegisterResult } from "@/lib/participants/promotion-membership";

const participantRowSchema = z.object({
  name: z.string().trim().min(2, "Identifiant trop court (Prénom Nom)"),
});

export type BulkParticipantResult = ParticipantCreationResult;

export interface BulkParticipantsFormState {
  error?: string;
  results?: BulkParticipantResult[];
}

export async function createParticipantsBulk(
  promotionId: string,
  _prevState: BulkParticipantsFormState,
  formData: FormData,
): Promise<BulkParticipantsFormState> {
  const session = await requireAdmin();

  const names = formData.getAll("name").map((value) => String(value));
  const rows = names.map((name) => ({ name })).filter((row) => row.name.trim().length > 0);

  if (rows.length === 0) {
    return { error: "Ajoutez au moins un participant." };
  }

  const parsedRows: Array<{ name: string }> = [];
  for (const row of rows) {
    const parsed = participantRowSchema.safeParse(row);
    if (!parsed.success) {
      return { error: `"${row.name}" : ${parsed.error.issues[0]?.message ?? "données invalides"}` };
    }
    parsedRows.push({ name: parsed.data.name });
  }

  const results: BulkParticipantResult[] = [];
  const createdIds: string[] = [];
  for (const row of parsedRows) {
    const result = await createParticipantWithTempPassword({ name: row.name });
    results.push(result);

    if (result.status === "created") {
      createdIds.push(result.id);
      await logAudit({
        adminId: session.user.id,
        action: "participant.create",
        target: result.name,
        after: { name: result.name, promotionId },
      });
    }
  }

  if (createdIds.length > 0) {
    await registerParticipants(promotionId, createdIds);
  }

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/admin/participants");
  return { results };
}

export interface AddParticipantsFormState {
  error?: string;
  results?: RegisterResult[];
}

export async function addExistingParticipants(
  promotionId: string,
  _prevState: AddParticipantsFormState,
  formData: FormData,
): Promise<AddParticipantsFormState> {
  const session = await requireAdmin();

  const userIds = formData.getAll("userId").map((value) => String(value)).filter((value) => value.length > 0);
  if (userIds.length === 0) {
    return { error: "Sélectionnez au moins un participant." };
  }

  const results = await registerParticipants(promotionId, userIds);

  const registered = results.filter((result) => result.status === "registered");
  if (registered.length > 0) {
    await logAudit({
      adminId: session.user.id,
      action: "promotion.participants.add",
      target: promotionId,
      after: { userIds: registered.map((result) => result.userId) },
    });
  }

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/admin/participants");
  return { results };
}

export async function unregisterParticipantAction(promotionId: string, userId: string): Promise<void> {
  const session = await requireAdmin();

  await unregisterParticipant(promotionId, userId);

  await logAudit({
    adminId: session.user.id,
    action: "promotion.participants.remove",
    target: promotionId,
    after: { userId },
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/admin/participants");
}
