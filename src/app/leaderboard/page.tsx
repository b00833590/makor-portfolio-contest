import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getLeaderboard, type BestWorstPosition, type LeaderboardRow } from "@/lib/gamification/get-leaderboard";
import { getPromotionPerformanceSeries } from "@/lib/gamification/get-promotion-performance-series";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PromotionPerformanceChart } from "./promotion-performance-chart";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const medals = ["🥇", "🥈", "🥉"];

function RankChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <span className="text-muted-foreground">—</span>;
  const isPositive = change > 0;
  return (
    <span className={isPositive ? "text-gain" : "text-loss"}>
      {isPositive ? "▲" : "▼"} {Math.abs(change)}
    </span>
  );
}

function BestWorstCell({ position }: { position: BestWorstPosition | null }) {
  if (!position) return <span className="text-muted-foreground">—</span>;
  const isPositive = position.pnlPct >= 0;
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium">{position.symbol}</span>{" "}
      <span className={cn("tabular-nums", isPositive ? "text-gain" : "text-loss")}>
        {isPositive ? "+" : ""}
        {position.pnlPct.toFixed(1)}%
      </span>
    </span>
  );
}

function PodiumCard({ row, place, isSelf }: { row: LeaderboardRow; place: number; isSelf: boolean }) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center gap-1 py-6 text-center",
        place === 1 && "border-primary/40 bg-primary/5",
        isSelf && "ring-1 ring-primary",
      )}
    >
      <span className="text-3xl">{medals[place - 1]}</span>
      <p className="mt-1 font-medium">
        {row.name}
        {isSelf && (
          <Badge variant="secondary" className="ml-2 align-middle">
            Vous
          </Badge>
        )}
      </p>
      <p className={cn("text-lg font-semibold tabular-nums", row.cumulativeReturnPct >= 0 ? "text-gain" : "text-loss")}>
        {row.cumulativeReturnPct >= 0 ? "+" : ""}
        {row.cumulativeReturnPct.toFixed(1)}%
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">{currencyFormatter.format(row.totalValue)}</p>
    </Card>
  );
}

export default async function LeaderboardPage() {
  const session = await verifySession();
  const user = await db.user.findUnique({ where: { id: session.user.id } });

  const header = (
    <SiteHeader
      name={session.user.name}
      role={session.user.role}
    />
  );

  if (!user?.promotionId) {
    return (
      <>
        {header}
        <div className="mx-auto w-full max-w-5xl px-6 py-10">
          <p className="text-sm text-muted-foreground">
            Vous n&apos;êtes assigné à aucune promotion pour le moment.
          </p>
        </div>
      </>
    );
  }

  const [leaderboard, performanceSeries, promotion] = await Promise.all([
    getLeaderboard(user.promotionId),
    getPromotionPerformanceSeries(user.promotionId),
    db.promotion.findUniqueOrThrow({ where: { id: user.promotionId }, select: { initialCapital: true } }),
  ]);
  const podium = leaderboard.slice(0, 3);
  const weeklyChallengeLeader = leaderboard
    .filter((row) => row.weeklyReturnPct !== null)
    .sort((a, b) => (b.weeklyReturnPct ?? 0) - (a.weeklyReturnPct ?? 0))[0];

  return (
    <>
      {header}
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Classement</h1>

        {weeklyChallengeLeader && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Défi de la semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Meilleure progression sur 7 jours :{" "}
                <span className="font-semibold text-foreground">{weeklyChallengeLeader.name}</span>{" "}
                avec{" "}
                <span className="font-semibold text-gain">
                  +{weeklyChallengeLeader.weeklyReturnPct!.toFixed(1)}%
                </span>
              </p>
            </CardContent>
          </Card>
        )}

        {podium.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            {podium.map((row, index) => (
              <PodiumCard key={row.userId} row={row} place={index + 1} isSelf={row.userId === session.user.id} />
            ))}
          </div>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Évolution comparée des participants</CardTitle>
          </CardHeader>
          <CardContent>
            <PromotionPerformanceChart
              points={performanceSeries.points}
              participantNames={performanceSeries.participantNames}
              initialCapital={Number(promotion.initialCapital)}
            />
          </CardContent>
        </Card>

        {leaderboard.length > 0 && (
          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>Rang</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Valeur du portefeuille</TableHead>
                <TableHead>Rendement</TableHead>
                <TableHead>Évolution (24h)</TableHead>
                <TableHead>Meilleure position</TableHead>
                <TableHead>Pire position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((row) => (
                <TableRow
                  key={row.userId}
                  className={cn(row.userId === session.user.id && "bg-muted/50 font-medium")}
                >
                  <TableCell>{row.rank}</TableCell>
                  <TableCell>
                    {row.name}
                    {row.userId === session.user.id && (
                      <Badge variant="secondary" className="ml-2">
                        Vous
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{currencyFormatter.format(row.totalValue)}</TableCell>
                  <TableCell className={cn("tabular-nums", row.cumulativeReturnPct >= 0 ? "text-gain" : "text-loss")}>
                    {row.cumulativeReturnPct >= 0 ? "+" : ""}
                    {row.cumulativeReturnPct.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <RankChangeIndicator change={row.rankChange} />
                  </TableCell>
                  <TableCell>
                    <BestWorstCell position={row.bestPosition} />
                  </TableCell>
                  <TableCell>
                    <BestWorstCell position={row.worstPosition} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {leaderboard.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            Aucun participant dans cette promotion pour le moment.
          </p>
        )}
      </div>
    </>
  );
}
