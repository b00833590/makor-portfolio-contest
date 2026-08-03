import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContestStats } from "@/lib/gamification/get-contest-stats";
import { AllocationList, StatTile } from "./stat-tile";
import { ASSET_TYPE_LABELS, signedCurrency, signedPct } from "./format";

export function ContestStatsSection({ stats }: { stats: ContestStats }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Transactions au total" value={stats.totalTransactionCount.toString()} />
        <StatTile
          label="Actif le plus détenu"
          value={stats.mostHeldAsset ? stats.mostHeldAsset.symbol : "—"}
          hint={stats.mostHeldAsset ? `${stats.mostHeldAsset.participantCount} participant(s)` : undefined}
        />
        <StatTile
          label="Actif le plus performant"
          value={stats.bestPerformingAsset ? `${stats.bestPerformingAsset.symbol} ${signedPct(stats.bestPerformingAsset.avgPnlPct)}` : "—"}
          tone="positive"
        />
        <StatTile
          label="Actif le moins performant"
          value={stats.worstPerformingAsset ? `${stats.worstPerformingAsset.symbol} ${signedPct(stats.worstPerformingAsset.avgPnlPct)}` : "—"}
          tone="negative"
        />
        <StatTile
          label="Meilleure transaction"
          value={stats.bestTrade ? `${stats.bestTrade.participantName} · ${signedCurrency(stats.bestTrade.pnlEur)}` : "—"}
          hint={stats.bestTrade ? `${stats.bestTrade.symbol} · ${signedPct(stats.bestTrade.pnlPct)}` : undefined}
          tone="positive"
        />
        <StatTile
          label="Meilleure journée du concours"
          value={stats.bestContestDay ? `${stats.bestContestDay.participantName} · ${signedPct(stats.bestContestDay.dailyReturnPct)}` : "—"}
          hint={stats.bestContestDay?.date}
          tone="positive"
        />
        <StatTile
          label="Meilleur rendement hebdomadaire"
          value={stats.bestWeeklyReturn ? `${stats.bestWeeklyReturn.participantName} · ${signedPct(stats.bestWeeklyReturn.weeklyReturnPct)}` : "—"}
          tone="positive"
        />
        <StatTile
          label="Plus forte progression au classement"
          value={stats.biggestRankGain ? `${stats.biggestRankGain.participantName} · +${stats.biggestRankGain.rankChange}` : "—"}
          tone="positive"
        />
        <StatTile
          label="Plus forte chute au classement"
          value={stats.biggestRankDrop ? `${stats.biggestRankDrop.participantName} · ${stats.biggestRankDrop.rankChange}` : "—"}
          tone="negative"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition sectorielle des investissements</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationList slices={stats.sectorAllocation} emptyLabel="Aucune position ouverte pour le moment." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition Actions / ETF / Crypto</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationList
              slices={stats.assetClassAllocation.map((slice) => ({
                key: ASSET_TYPE_LABELS[slice.key] ?? slice.key,
                valuePct: slice.valuePct,
              }))}
              emptyLabel="Aucune position ouverte pour le moment."
            />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        La répartition géographique des investissements n&apos;est pas encore disponible : les actifs ne sont pas
        rattachés à un pays dans la base de données.
      </p>
    </div>
  );
}
