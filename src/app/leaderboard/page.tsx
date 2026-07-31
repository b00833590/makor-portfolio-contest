import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getLeaderboard } from "@/lib/gamification/get-leaderboard";
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

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function RankChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <span className="text-zinc-400">—</span>;
  const isPositive = change > 0;
  return (
    <span className={isPositive ? "text-emerald-600" : "text-red-600"}>
      {isPositive ? "▲" : "▼"} {Math.abs(change)}
    </span>
  );
}

export default async function LeaderboardPage() {
  const session = await verifySession();
  const user = await db.user.findUnique({ where: { id: session.user.id } });

  if (!user?.promotionId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className="text-sm text-zinc-500">
          Vous n&apos;êtes assigné à aucune promotion pour le moment.
        </p>
      </div>
    );
  }

  const leaderboard = await getLeaderboard(user.promotionId);
  const weeklyChallengeLeader = leaderboard
    .filter((row) => row.weeklyReturnPct !== null)
    .sort((a, b) => (b.weeklyReturnPct ?? 0) - (a.weeklyReturnPct ?? 0))[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Classement</h1>
        <div className="flex items-center gap-3">
          <Link href="/hall-of-fame" className="text-sm text-zinc-500 hover:underline">
            Hall of Fame
          </Link>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
            ← Tableau de bord
          </Link>
        </div>
      </div>

      {weeklyChallengeLeader && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Défi de la semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Meilleure progression sur 7 jours :{" "}
              <span className="font-semibold text-foreground">{weeklyChallengeLeader.name}</span>{" "}
              avec{" "}
              <span className="font-semibold text-emerald-600">
                {weeklyChallengeLeader.weeklyReturnPct!.toFixed(1)}%
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Rang</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead>Valeur du portefeuille</TableHead>
            <TableHead>Rendement</TableHead>
            <TableHead className="text-right">Évolution (7j)</TableHead>
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
              <TableCell>{currencyFormatter.format(row.totalValue)}</TableCell>
              <TableCell className={row.cumulativeReturnPct >= 0 ? "text-emerald-600" : "text-red-600"}>
                {row.cumulativeReturnPct >= 0 ? "+" : ""}
                {row.cumulativeReturnPct.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right">
                <RankChangeIndicator change={row.rankChange} />
              </TableCell>
            </TableRow>
          ))}
          {leaderboard.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-zinc-500">
                Aucun participant dans cette promotion pour le moment.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
