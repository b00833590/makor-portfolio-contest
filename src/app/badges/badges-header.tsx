import { RARITY_LABEL, RARITY_BAR_CLASSNAME, RARITY_ORDER } from "@/lib/gamification/badge-display";
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

      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {RARITY_ORDER.map((rarity) => {
          const row = board.byRarity.find((r) => r.rarity === rarity);
          if (!row || row.total === 0) return null;
          const widthPct = (row.total / board.totalCount) * 100;
          const earnedPct = row.total > 0 ? (row.earned / row.total) * 100 : 0;
          return (
            <div key={rarity} style={{ width: `${widthPct}%` }} className="h-full bg-muted-foreground/10">
              <div className={`h-full ${RARITY_BAR_CLASSNAME[rarity]}`} style={{ width: `${earnedPct}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {board.byRarity.map((row) => (
          <span key={row.rarity} className="tabular-nums">
            {RARITY_LABEL[row.rarity]} {row.earned}/{row.total}
          </span>
        ))}
      </div>
    </div>
  );
}
