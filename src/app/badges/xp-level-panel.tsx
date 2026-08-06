import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { BadgeBoard } from "@/lib/gamification/get-badge-board";

export function XpLevelPanel({ board }: { board: BadgeBoard }) {
  const { level } = board;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Niveau {level.level} — {level.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-2xl font-semibold tabular-nums">
          {level.xp} <span className="text-base font-normal text-muted-foreground">XP</span>
        </p>
        {level.xpForNextLevel !== null ? (
          <>
            <Progress value={level.progressPct} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {level.xpIntoLevel} / {level.xpForNextLevel} XP vers le niveau suivant
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Niveau maximum atteint 🎉</p>
        )}
      </CardContent>
    </Card>
  );
}
