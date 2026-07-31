import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { snapshotActivePromotions } from "@/lib/trading/snapshot-service";
import { evaluateAndAwardBadges } from "@/lib/gamification/evaluate-badges";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const snapshotResults = await snapshotActivePromotions();

  // Les badges dépendent des snapshots qui viennent d'être créés (rendement, rang) —
  // évalués juste après, dans le même job planifié plutôt qu'un cron dédié (limite
  // de 2 crons sur le plan Vercel Hobby déjà atteinte avec ingest-prices).
  const activePromotions = await db.promotion.findMany({
    where: { status: PromotionStatus.ACTIVE },
    select: { id: true },
  });
  const badgeResults = await Promise.all(
    activePromotions.map((promotion) => evaluateAndAwardBadges(promotion.id)),
  );

  return NextResponse.json({ snapshotResults, badgeResults: badgeResults.flat() });
}
