import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParticipantStats } from "@/lib/gamification/get-participant-stats";
import { AllocationList, StatTile } from "./stat-tile";
import { ASSET_TYPE_LABELS, signedCurrency, signedPct } from "./format";

export function ParticipantStatsSection({ stats }: { stats: ParticipantStats }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          label="Rendement du concours"
          value={signedPct(stats.cumulativeReturnPct)}
          tone={stats.cumulativeReturnPct >= 0 ? "positive" : "negative"}
        />
        <StatTile
          label="Rendement hebdomadaire"
          value={stats.weeklyReturnPct === null ? "—" : signedPct(stats.weeklyReturnPct)}
          tone={stats.weeklyReturnPct !== null && stats.weeklyReturnPct >= 0 ? "positive" : "negative"}
        />
        <StatTile
          label="Rendement journalier"
          value={stats.dailyReturnPct === null ? "—" : signedPct(stats.dailyReturnPct)}
          tone={stats.dailyReturnPct !== null && stats.dailyReturnPct >= 0 ? "positive" : "negative"}
        />
        <StatTile
          label="Volatilité (écart-type journalier)"
          value={stats.volatilityPct === null ? "—" : `${stats.volatilityPct.toFixed(2)} pts`}
        />
        <StatTile
          label="Gain latent total"
          value={signedCurrency(stats.unrealizedGainEur)}
          tone={stats.unrealizedGainEur >= 0 ? "positive" : "negative"}
        />
        <StatTile label="Transactions réalisées" value={stats.transactionCount.toString()} />
        <StatTile
          label="Taux de réussite"
          value={stats.winRatePct === null ? "—" : `${stats.winRatePct.toFixed(0)}%`}
          hint="Positions gagnantes / total"
        />
        <StatTile
          label="Performance moyenne par position"
          value={stats.avgPositionPerformancePct === null ? "—" : signedPct(stats.avgPositionPerformancePct)}
          tone={
            stats.avgPositionPerformancePct === null
              ? "neutral"
              : stats.avgPositionPerformancePct >= 0
                ? "positive"
                : "negative"
          }
        />
        <StatTile
          label="Gain moyen par trade gagnant"
          value={stats.avgGainPerWinningTradeEur === null ? "—" : signedCurrency(stats.avgGainPerWinningTradeEur)}
          tone="positive"
        />
        <StatTile
          label="Perte moyenne par trade perdant"
          value={stats.avgLossPerLosingTradeEur === null ? "—" : signedCurrency(stats.avgLossPerLosingTradeEur)}
          tone="negative"
        />
        <StatTile
          label="Meilleure position"
          value={stats.bestPosition ? `${stats.bestPosition.symbol} ${signedPct(stats.bestPosition.pnlPct)}` : "—"}
          tone="positive"
        />
        <StatTile
          label="Pire position"
          value={stats.worstPosition ? `${stats.worstPosition.symbol} ${signedPct(stats.worstPosition.pnlPct)}` : "—"}
          tone="negative"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition sectorielle</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationList slices={stats.sectorAllocation} emptyLabel="Aucune position ouverte pour le moment." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par classe d&apos;actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationList
              slices={stats.assetClassAllocation.map((slice) => ({
                key: ASSET_TYPE_LABELS[slice.key as keyof typeof ASSET_TYPE_LABELS] ?? slice.key,
                valuePct: slice.valuePct,
              }))}
              emptyLabel="Aucune position ouverte pour le moment."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
