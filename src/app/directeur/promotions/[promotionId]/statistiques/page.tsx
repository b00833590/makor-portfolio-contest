import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getCachedLeaderboard, getLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getCachedContestStats } from "@/lib/gamification/get-contest-stats";
import { ContestStatsSection } from "@/app/statistiques/contest-stats-section";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function DirecteurStatistiquesPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { promotionId } = await params;
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { status: true, endDate: true },
  });
  if (!promotion) {
    notFound();
  }

  const contestClosed = promotion.status === PromotionStatus.CLOSED;
  const leaderboard = contestClosed
    ? await getLeaderboard(promotionId, promotion.endDate, { frozen: true })
    : await getCachedLeaderboard(promotionId);
  const contestStats = await getCachedContestStats(promotionId, leaderboard);

  return (
    <div>
      {!contestClosed && <AutoRefresh />}
      <h2 className="text-xl font-semibold tracking-tight">Statistiques du concours</h2>
      <div className="mt-6">
        <ContestStatsSection stats={contestStats} />
      </div>
    </div>
  );
}
