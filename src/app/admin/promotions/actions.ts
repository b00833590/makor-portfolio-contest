"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { provisionPortfolios } from "@/lib/portfolio-provisioning";
import { PromotionStatus } from "@/generated/prisma/enums";
import { createPromotionSchema } from "./schema";

export interface PromotionFormState {
  error?: string;
}

export async function createPromotion(
  _prevState: PromotionFormState,
  formData: FormData,
): Promise<PromotionFormState> {
  const session = await requireAdmin();

  const parsed = createPromotionSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    initialCapital: formData.get("initialCapital"),
    minPositionSize: formData.get("minPositionSize"),
    maxPositionSize: formData.get("maxPositionSize"),
    maxPositions: formData.get("maxPositions"),
    maxCryptoAllocationPct: formData.get("maxCryptoAllocationPct"),
    changeSessionsPerWeek: formData.get("changeSessionsPerWeek"),
    maxChangesPerSession: formData.get("maxChangesPerSession"),
    freezeHoursBeforeEnd: formData.get("freezeHoursBeforeEnd"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { name, startDate, endDate, initialCapital, ...ruleFields } = parsed.data;
  const rules = promotionRulesSchema.parse(ruleFields);

  const promotion = await db.promotion.create({
    data: {
      name,
      startDate,
      endDate,
      initialCapital,
      rules,
      status: PromotionStatus.DRAFT,
    },
  });

  await logAudit({
    adminId: session.user.id,
    action: "promotion.create",
    target: promotion.id,
    after: { name, startDate, endDate, initialCapital, rules },
  });

  revalidatePath("/admin/promotions");
  return {};
}

export async function setPromotionStatus(promotionId: string, status: PromotionStatus) {
  const session = await requireAdmin();

  const before = await db.promotion.findUniqueOrThrow({ where: { id: promotionId } });
  const promotion = await db.promotion.update({
    where: { id: promotionId },
    data: { status },
  });

  let provisionedCount: number | undefined;
  if (status === PromotionStatus.ACTIVE) {
    provisionedCount = await provisionPortfolios(promotionId);
  }

  await logAudit({
    adminId: session.user.id,
    action: "promotion.status",
    target: promotionId,
    before: { status: before.status },
    after: { status: promotion.status, provisionedPortfolios: provisionedCount },
  });

  revalidatePath("/admin/promotions");
}
