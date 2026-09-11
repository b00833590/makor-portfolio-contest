import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signedPct } from "@/app/statistiques/format";
import type { HallOfFameEntryView } from "@/lib/gamification/hall-of-fame";

/**
 * Miroir "pire performance" du Hall of Fame — réutilise `entries` (même liste
 * triée par getHallOfFame, lue par l'autre bout) donc jamais de source de
 * vérité divergente entre les deux moitiés de la page.
 */
export function HallOfShameSection({
  worstRecord,
  worstEntries,
}: {
  worstRecord: HallOfFameEntryView | null;
  worstEntries: HallOfFameEntryView[];
}) {
  if (!worstRecord) return null;

  return (
    <section className="mt-12">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hall of Shame</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Parce que ça aussi, ça fait partie de l&rsquo;histoire.
      </p>

      <Card className="mt-6 border-loss/40 bg-loss/5">
        <CardHeader>
          <CardTitle>Pire performance historique 🍌</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <UserAvatar name={worstRecord.userName} avatarUrl={worstRecord.avatarUrl} className="size-10 shrink-0" />
          <p>
            Pire performance jamais enregistrée :{" "}
            <span className="font-semibold text-foreground">{worstRecord.userName}</span> avec{" "}
            <span className="font-semibold text-loss">{signedPct(worstRecord.finalReturnPct)}</span> lors de «&nbsp;
            {worstRecord.promotionName}&nbsp;».
          </p>
        </CardContent>
      </Card>

      {worstEntries.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Pires performances de tous les temps</h2>
          <Card className="mt-4 border-loss/20">
            <CardContent className="flex flex-col gap-1.5 pt-6">
              {worstEntries.map((e, i) => (
                <div
                  key={`${e.promotionId}-${e.finalRank}`}
                  className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0"
                >
                  <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                  <UserAvatar name={e.userName} avatarUrl={e.avatarUrl} size="sm" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{e.userName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{e.promotionName}</span>
                  </span>
                  <span
                    className={
                      e.finalReturnPct >= 0 ? "shrink-0 text-gain tabular-nums" : "shrink-0 text-loss tabular-nums"
                    }
                  >
                    {signedPct(e.finalReturnPct)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
