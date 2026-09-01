import { RARITY_LABEL, RARITY_BAR_CLASSNAME, RARITY_TEXT_CLASSNAME } from "@/lib/gamification/badge-display";
import type { BadgeBoard } from "@/lib/gamification/get-badge-board";

type Props = { board: BadgeBoard };

export function BadgesHeader({ board }: Props) {
  const { level } = board;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Collection</p>
          <p className="text-3xl font-semibold tabular-nums">
            {board.earnedCount} <span className="text-lg font-normal text-muted-foreground">/ {board.totalCount}</span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Niveau {level.level} · <span className="font-medium text-foreground">{level.label}</span> · {level.xp} XP
          {level.xpForNextLevel !== null && (
            <span className="text-muted-foreground"> · +{level.xpForNextLevel - level.xpIntoLevel} → niv. suiv.</span>
          )}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {board.byRarity.map((row) => {
          if (row.total === 0) return null;
          const earnedPct = (row.earned / row.total) * 100;
          return (
            <div key={row.rarity} className="flex flex-col gap-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${RARITY_BAR_CLASSNAME[row.rarity]}`} style={{ width: `${earnedPct}%` }} />
              </div>
              <p className="text-center text-sm font-semibold tabular-nums">
                {row.earned} <span className="text-muted-foreground">/ {row.total}</span>
              </p>
              <p className={`text-center text-xs font-medium ${RARITY_TEXT_CLASSNAME[row.rarity]}`}>
                {RARITY_LABEL[row.rarity]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
