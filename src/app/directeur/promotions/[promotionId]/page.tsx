import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getCachedLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getFrozenLeaderboard } from "@/lib/gamification/frozen-leaderboard";
import { computeLeaderboardHighlights } from "@/lib/gamification/leaderboard-highlights";
import { formatTimeRemaining } from "@/lib/format-duration";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/components/auto-refresh";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pctFormatter = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export default async function DirecteurPromotionOverviewPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { promotionId } = await params;

  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { status: true, endDate: true, initialCapital: true },
  });
  if (!promotion) {
    notFound();
  }
  if (promotion.status === PromotionStatus.DRAFT) {
    notFound();
  }

  const participantCount = await db.promotionParticipant.count({ where: { promotionId } });

  if (promotion.status === PromotionStatus.CLOSED) {
    const frozenRows = await getFrozenLeaderboard(promotionId);
    const podium = frozenRows.slice(0, 3);
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Participants</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">{participantCount}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Capital initial</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {currencyFormatter.format(Number(promotion.initialCapital))}
            </CardContent>
          </Card>
        </div>
        {podium.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">Podium final</h2>
            <div className="mt-3 flex flex-col gap-2">
              {podium.map((row) => (
                <div
                  key={row.finalRank}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-center">{["🥇", "🥈", "🥉"][row.finalRank - 1]}</span>
                    <UserAvatar name={row.userName} avatarUrl={row.avatarUrl} size="sm" className="shrink-0" />
                    <span className="min-w-0 truncate font-medium">{row.userName}</span>
                  </span>
                  <span className={row.finalReturnPct >= 0 ? "text-gain tabular-nums" : "text-loss tabular-nums"}>
                    {pctFormatter(row.finalReturnPct)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const leaderboard = await getCachedLeaderboard(promotionId);
  const highlights = computeLeaderboardHighlights(leaderboard);

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Participants</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{participantCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Temps restant</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{formatTimeRemaining(promotion.endDate)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capital initial</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {currencyFormatter.format(Number(promotion.initialCapital))}
          </CardContent>
        </Card>
      </div>

      {leaderboard.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {highlights.leader && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">🏆 Leader</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <UserAvatar name={highlights.leader.name} avatarUrl={highlights.leader.avatarUrl} size="sm" />
                <span className="min-w-0 truncate font-medium">{highlights.leader.name}</span>
                <span className="ml-auto shrink-0 text-gain tabular-nums">
                  {pctFormatter(highlights.leader.cumulativeReturnPct)}
                </span>
              </CardContent>
            </Card>
          )}
          {highlights.bestMover && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">▲ Meilleure progression (7j)</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <UserAvatar name={highlights.bestMover.name} avatarUrl={highlights.bestMover.avatarUrl} size="sm" />
                <span className="min-w-0 truncate font-medium">{highlights.bestMover.name}</span>
                <span className="ml-auto shrink-0 text-gain tabular-nums">
                  {pctFormatter(highlights.bestMover.weeklyReturnPct ?? 0)}
                </span>
              </CardContent>
            </Card>
          )}
          {highlights.underperformer && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">▼ Sous-performance</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <UserAvatar name={highlights.underperformer.name} avatarUrl={highlights.underperformer.avatarUrl} size="sm" />
                <span className="min-w-0 truncate font-medium">{highlights.underperformer.name}</span>
                <span className="ml-auto shrink-0 text-loss tabular-nums">
                  {pctFormatter(highlights.underperformer.cumulativeReturnPct)}
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold">Participants</h2>
        {leaderboard.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun participant dans cette promotion pour le moment.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-1">
            {leaderboard.map((row) => (
              <Link
                key={row.userId}
                href={`/directeur/participants/${row.userId}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{row.rank}</span>
                  <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
                  <span className="min-w-0 truncate font-medium">{row.name}</span>
                </span>
                <span className={row.cumulativeReturnPct >= 0 ? "shrink-0 text-gain tabular-nums" : "shrink-0 text-loss tabular-nums"}>
                  {pctFormatter(row.cumulativeReturnPct)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
