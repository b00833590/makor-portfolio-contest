import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { BadgeBoard } from "@/lib/gamification/get-badge-board";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export function ProgressHeader({ board }: { board: BadgeBoard }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Card className="col-span-2 sm:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Progression</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-2xl font-semibold tabular-nums">
            {board.earnedCount} <span className="text-base font-normal text-muted-foreground">/ {board.totalCount}</span>
          </p>
          <Progress value={board.completionPct} />
          <p className="text-xs text-muted-foreground tabular-nums">{board.completionPct.toFixed(0)}% complété</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Badges rares</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold tabular-nums">{board.rareOwnedCount}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Le plus récent</CardTitle>
        </CardHeader>
        <CardContent>
          {board.mostRecentBadge ? (
            <div className="flex items-center gap-2">
              <span className="text-xl">{board.mostRecentBadge.icon}</span>
              <div>
                <p className="text-sm font-medium">{board.mostRecentBadge.name}</p>
                {board.mostRecentBadge.awardedAt && (
                  <p className="text-xs text-muted-foreground">{dateFormatter.format(board.mostRecentBadge.awardedAt)}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun badge pour le moment</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
