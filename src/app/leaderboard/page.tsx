import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getCachedLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getCachedPromotionPerformanceSeries } from "@/lib/gamification/get-promotion-performance-series";
import { getFrozenLeaderboard } from "@/lib/gamification/frozen-leaderboard";
import { closePromotionIfEnded } from "@/lib/promotion-lifecycle";
import { computeLeaderboardGaps } from "@/lib/gamification/leaderboard-gaps";
import { PromotionStatus } from "@/generated/prisma/enums";
import { roleHomePath } from "@/lib/auth/role-display";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { LeaderboardBoard, FrozenLeaderboardBoard } from "@/components/leaderboard/leaderboard-board";

export default async function LeaderboardPage() {
  const session = await verifySession();
  // Seul un participant a un classement personnel à consulter ici — admin et
  // Directeur ont leurs propres espaces (voir dashboard/page.tsx pour le même choix).
  if (session.user.role !== "PARTICIPANT") {
    redirect(roleHomePath(session.user.role));
  }
  const user = await db.user.findUnique({ where: { id: session.user.id } });

  const header = (
    <>
      <AutoRefresh />
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
    </>
  );

  if (!user?.promotionId) {
    return (
      <>
        {header}
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="text-sm text-muted-foreground">
            Vous n&apos;êtes assigné à aucune promotion pour le moment.
          </p>
        </div>
      </>
    );
  }

  await closePromotionIfEnded(user.promotionId);

  const promotion = await db.promotion.findUniqueOrThrow({
    where: { id: user.promotionId },
    select: { initialCapital: true, status: true, endDate: true },
  });

  if (promotion.status === PromotionStatus.CLOSED) {
    // Concours clôturé : classement figé, aucun recalcul live, pas de <AutoRefresh />.
    const frozenRows = await getFrozenLeaderboard(user.promotionId);
    return (
      <>
        <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Classement</h1>
            <Badge>Classement final</Badge>
          </div>
          <FrozenLeaderboardBoard rows={frozenRows} endDate={promotion.endDate} selfUserId={session.user.id} />
        </div>
      </>
    );
  }

  const [leaderboard, performanceSeries] = await Promise.all([
    getCachedLeaderboard(user.promotionId),
    getCachedPromotionPerformanceSeries(user.promotionId),
  ]);
  const gaps = computeLeaderboardGaps(leaderboard);

  return (
    <>
      {header}
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Classement</h1>
        <LeaderboardBoard
          leaderboard={leaderboard}
          gaps={gaps}
          selfUserId={session.user.id}
          performanceSeries={performanceSeries}
          initialCapital={Number(promotion.initialCapital)}
        />
      </div>
    </>
  );
}
