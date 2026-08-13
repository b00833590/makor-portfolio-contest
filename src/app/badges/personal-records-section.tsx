import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PersonalRecords } from "@/lib/gamification/get-personal-records";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function signed(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function PersonalRecordsSection({ records }: { records: PersonalRecords }) {
  const hasAnyRecord = records.bestDayPct !== null || records.bestTradePct !== null || records.longestHoldDays !== null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Mes records</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnyRecord && <p className="text-sm text-muted-foreground">Pas encore assez d&apos;activité pour établir vos records.</p>}
        {hasAnyRecord && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Meilleure journée</span>
              <span className={`text-lg font-semibold tabular-nums ${(records.bestDayPct ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                {records.bestDayPct !== null ? signed(records.bestDayPct) : "—"}
              </span>
              {records.bestDayDate && (
                <span className="text-xs text-muted-foreground">{dateFormatter.format(new Date(records.bestDayDate))}</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Meilleur trade</span>
              <span className={`text-lg font-semibold tabular-nums ${(records.bestTradePct ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                {records.bestTradePct !== null ? signed(records.bestTradePct) : "—"}
              </span>
              {records.bestTradeAssetSymbol && (
                <span className="text-xs text-muted-foreground">{records.bestTradeAssetSymbol}</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Plus longue détention</span>
              <span className="text-lg font-semibold tabular-nums">
                {records.longestHoldDays !== null ? `${records.longestHoldDays} j` : "—"}
              </span>
              {records.longestHoldAssetSymbol && (
                <span className="text-xs text-muted-foreground">{records.longestHoldAssetSymbol}</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
