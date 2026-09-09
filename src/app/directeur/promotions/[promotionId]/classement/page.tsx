import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getCachedLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getFrozenLeaderboard } from "@/lib/gamification/frozen-leaderboard";
import { getCachedPromotionPerformanceSeries } from "@/lib/gamification/get-promotion-performance-series";
import { computeLeaderboardGaps } from "@/lib/gamification/leaderboard-gaps";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { LeaderboardBoard, FrozenLeaderboardBoard } from "@/components/leaderboard/leaderboard-board";

export default async function DirecteurClassementPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { promotionId } = await params;
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { initialCapital: true, status: true, endDate: true },
  });
  if (!promotion) {
    notFound();
  }

  if (promotion.status === PromotionStatus.CLOSED) {
    const frozenRows = await getFrozenLeaderboard(promotionId);
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Classement</h2>
          <Badge>Classement final</Badge>
        </div>
        <FrozenLeaderboardBoard rows={frozenRows} endDate={promotion.endDate} selfUserId={null} />
      </div>
    );
  }

  const [leaderboard, performanceSeries] = await Promise.all([
    getCachedLeaderboard(promotionId),
    getCachedPromotionPerformanceSeries(promotionId),
  ]);
  const gaps = computeLeaderboardGaps(leaderboard);

  return (
    <div>
      <AutoRefresh />
      <h2 className="text-xl font-semibold tracking-tight">Classement</h2>
      <LeaderboardBoard
        leaderboard={leaderboard}
        gaps={gaps}
        selfUserId={null}
        performanceSeries={performanceSeries}
        initialCapital={Number(promotion.initialCapital)}
      />
    </div>
  );
}
