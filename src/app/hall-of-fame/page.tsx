import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { getHallOfFame } from "@/lib/gamification/hall-of-fame";
import { pickWinner } from "@/lib/gamification/pick-winner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HallOfFamePage() {
  await verifySession();
  const seasons = await getHallOfFame();

  const bestEver = pickWinner(
    seasons
      .filter((season) => season.winner !== null)
      .map((season) => ({ ...season.winner!, promotionName: season.name })),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Hall of Fame</h1>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline">
          ← Tableau de bord
        </Link>
      </div>

      {bestEver && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Record historique</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Meilleure performance jamais enregistrée :{" "}
              <span className="font-semibold text-foreground">{bestEver.name}</span> avec{" "}
              <span className="font-semibold text-emerald-600">
                +{bestEver.cumulativeReturnPct.toFixed(1)}%
              </span>{" "}
              lors de la saison &laquo;&nbsp;{bestEver.promotionName}&nbsp;&raquo;.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {seasons.length === 0 && (
          <p className="text-sm text-zinc-500">
            Aucune saison terminée pour le moment — revenez à la fin du concours en cours.
          </p>
        )}
        {seasons.map((season) => (
          <Card key={season.promotionId}>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>{season.name}</CardTitle>
                <p className="mt-1 text-sm text-zinc-500">
                  {season.startDate.toLocaleDateString("fr-FR")} →{" "}
                  {season.endDate.toLocaleDateString("fr-FR")}
                </p>
              </div>
              {season.winner ? (
                <div className="text-right">
                  <Badge>🏆 {season.winner.name}</Badge>
                  <p className="mt-1 text-sm text-emerald-600">
                    +{season.winner.cumulativeReturnPct.toFixed(1)}%
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Aucun participant</p>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
