"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { createParticipantWithTempPassword, type ParticipantCreationResult } from "@/lib/participants/create-participant";

const participantRowSchema = z.object({
  name: z.string().trim().min(2, "Identifiant trop court (Prénom Nom)"),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
});

export type BulkParticipantResult = ParticipantCreationResult & { email?: string };

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
  const emails = formData.getAll("email").map((value) => String(value));

  const rows = names
    .map((name, index) => ({ name, email: emails[index] ?? "" }))
    .filter((row) => row.name.trim().length > 0);

  if (rows.length === 0) {
    return { error: "Ajoutez au moins un participant." };
  }

  const parsedRows: Array<{ name: string; email?: string }> = [];
  for (const row of rows) {
    const parsed = participantRowSchema.safeParse(row);
    if (!parsed.success) {
      return { error: `"${row.name}" : ${parsed.error.issues[0]?.message ?? "données invalides"}` };
    }
    parsedRows.push({ name: parsed.data.name, email: parsed.data.email || undefined });
  }

  const results: BulkParticipantResult[] = [];
  for (const row of parsedRows) {
    const result = await createParticipantWithTempPassword({ name: row.name, promotionId });
    results.push({ ...result, email: row.email });

    if (result.status === "created") {
      await logAudit({
        adminId: session.user.id,
        action: "participant.create",
        target: result.name,
        after: { name: result.name, promotionId },
      });
    }
  }

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/admin/participants");
  return { results };
}
