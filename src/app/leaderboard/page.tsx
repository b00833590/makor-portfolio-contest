import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getLeaderboard, type BestWorstPosition, type LeaderboardRow } from "@/lib/gamification/get-leaderboard";
import { getPromotionPerformanceSeries } from "@/lib/gamification/get-promotion-performance-series";
import { computeLeaderboardGaps, type LeaderboardGaps } from "@/lib/gamification/leaderboard-gaps";
import { SiteHeader } from "@/components/site-header";
import { UserAvatar } from "@/components/user-avatar";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PromotionPerformanceChart } from "./promotion-performance-chart";
import { AutoRefresh } from "@/components/auto-refresh";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const medals = ["🥇", "🥈", "🥉"];

/** En-tête compact façon terminal financier — petites majuscules espacées plutôt que le style de titre habituel de l'app, réservé à ce tableau. */
function ColHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <TableHead className={cn("text-xs font-semibold tracking-wide text-muted-foreground uppercase", className)}>
      {children}
    </TableHead>
  );
}

function RankCell({ rank }: { rank: number }) {
  const medal = medals[rank - 1];
  return (
    <span className="flex items-center justify-center gap-1 tabular-nums">
      {medal ?? rank}
    </span>
  );
}

function RankChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <span className="text-muted-foreground">—</span>;
  const isPositive = change > 0;
  return (
    <span className={cn("tabular-nums", isPositive ? "text-gain" : "text-loss")}>
      {isPositive ? "▲" : "▼"} {Math.abs(change)}
    </span>
  );
}

/**
 * Écart avec le leader affiché directement (la comparaison la plus lue
 * d'un coup d'œil), écart avec les voisins immédiats du classement révélé
 * au survol — trois comparaisons utiles sans les étaler sur trois colonnes.
 */
function GapCell({ gaps }: { gaps: LeaderboardGaps }) {
  if (!gaps.toLeader) {
    return <span className="font-medium text-primary">🏆 Leader</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="cursor-help tabular-nums text-loss underline decoration-dotted underline-offset-4" />}
      >
        −{gaps.toLeader.pts.toFixed(1)} pts
      </TooltipTrigger>
      <TooltipContent side="top" className="flex flex-col gap-1">
        <p>🥇 Leader : −{currencyFormatter.format(gaps.toLeader.eur)}</p>
        {gaps.toAhead && <p>▲ Devant : −{currencyFormatter.format(gaps.toAhead.eur)}</p>}
        {gaps.toBehind && <p>▼ Derrière : +{currencyFormatter.format(gaps.toBehind.eur)}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function PositionLine({ position, direction }: { position: BestWorstPosition; direction: "best" | "worst" }) {
  const isPositive = position.pnlPct >= 0;
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className={cn("shrink-0", direction === "best" ? "text-gain" : "text-loss")}>
        {direction === "best" ? "▲" : "▼"}
      </span>
      <span className="min-w-0 truncate font-medium">{position.symbol}</span>
      <span className={cn("shrink-0 tabular-nums", isPositive ? "text-gain" : "text-loss")}>
        {isPositive ? "+" : ""}
        {position.pnlPct.toFixed(1)}%
      </span>
    </span>
  );
}

/** Meilleure et pire position d'un participant dans une seule colonne — deux colonnes séparées pour un seul type d'information (une position) n'apportait rien de plus. */
function PositionsCell({ best, worst }: { best: BestWorstPosition | null; worst: BestWorstPosition | null }) {
  if (!best) return <span className="text-muted-foreground">—</span>;
  const single = !worst || worst.symbol === best.symbol;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <PositionLine position={best} direction="best" />
      {!single && <PositionLine position={worst!} direction="worst" />}
    </div>
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
      <UserAvatar name={row.name} avatarUrl={row.avatarUrl} className="mt-1 size-12 text-base" />
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
    <>
      <AutoRefresh />
      <SiteHeader
        name={session.user.name}
        role={session.user.role}
        avatarUrl={session.user.avatarUrl}
      />
    </>
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
  const gaps = computeLeaderboardGaps(leaderboard);
  const weeklyChallengeLeader = leaderboard
    .filter((row) => row.weeklyReturnPct !== null)
    .sort((a, b) => (b.weeklyReturnPct ?? 0) - (a.weeklyReturnPct ?? 0))[0];
  const participantAvatars = Object.fromEntries(leaderboard.map((row) => [row.name, row.avatarUrl]));

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
              participantAvatars={participantAvatars}
            />
          </CardContent>
        </Card>

        {leaderboard.length > 0 && (
          <Card className="mt-6 py-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <ColHead className="w-14 text-center">Rang</ColHead>
                  <ColHead className="w-[22%]">Participant</ColHead>
                  <ColHead className="w-[15%] text-right">Valeur</ColHead>
                  <ColHead className="w-[11%] text-right">Rendement</ColHead>
                  <ColHead className="w-[13%] text-right">Écart</ColHead>
                  <ColHead className="w-[9%] text-right">24 h</ColHead>
                  <ColHead>Positions extrêmes</ColHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((row, index) => (
                  <TableRow
                    key={row.userId}
                    className={cn(row.userId === session.user.id && "bg-muted/50 font-medium")}
                  >
                    <TableCell className="text-center">
                      <RankCell rank={row.rank} />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" className="shrink-0" />
                        <span className="min-w-0 truncate">{row.name}</span>
                        {row.userId === session.user.id && (
                          <Badge variant="secondary" className="shrink-0">
                            Vous
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{currencyFormatter.format(row.totalValue)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", row.cumulativeReturnPct >= 0 ? "text-gain" : "text-loss")}>
                      {row.cumulativeReturnPct >= 0 ? "+" : ""}
                      {row.cumulativeReturnPct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <GapCell gaps={gaps[index]} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RankChangeIndicator change={row.rankChange} />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <PositionsCell best={row.bestPosition} worst={row.worstPosition} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
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
