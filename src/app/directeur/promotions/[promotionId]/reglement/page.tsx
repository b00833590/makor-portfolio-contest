import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { computeChangeSessionStatus } from "@/lib/trading/change-session-status";
import { RulesDocument } from "@/components/rules-document";

export default async function DirecteurReglementPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { promotionId } = await params;
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    include: { changeSessions: { orderBy: { opensAt: "asc" } } },
  });
  if (!promotion) {
    notFound();
  }

  const now = new Date();

  return (
    <RulesDocument
      promotion={{
        name: promotion.name,
        startDate: promotion.startDate,
        endDate: promotion.endDate,
        initialCapital: Number(promotion.initialCapital),
        rules: promotionRulesSchema.parse(promotion.rules),
        rulesIntro: promotion.rulesIntro,
        rulesCustomNotes: promotion.rulesCustomNotes,
      }}
      changeSessions={promotion.changeSessions.map((session) => ({
        ...session,
        effectiveStatus: computeChangeSessionStatus(session, now),
      }))}
    />
  );
}
