"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { createParticipantWithTempPassword, type ParticipantCreationResult } from "@/lib/participants/create-participant";
import { provisionPortfolioIfPromotionActive } from "@/lib/portfolio-provisioning";

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
  for (const row of parsedRows) {
    const result = await createParticipantWithTempPassword({ name: row.name, promotionId });
    results.push(result);

    if (result.status === "created") {
      await logAudit({
        adminId: session.user.id,
        action: "participant.create",
        target: result.name,
        after: { name: result.name, promotionId },
      });
    }
  }

  if (results.some((result) => result.status === "created")) {
    await provisionPortfolioIfPromotionActive(promotionId);
  }

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/admin/participants");
  return { results };
}
