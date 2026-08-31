import { Lock, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RARITY_LABEL, RARITY_CLASSNAME, RARITY_CARD_ACCENT } from "@/lib/gamification/badge-display";
import { cn } from "@/lib/utils";
import type { BadgeBoardEntry } from "@/lib/gamification/get-badge-board";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

type Props = { entry: BadgeBoardEntry; justUnlocked: boolean };

export function BadgeCard({ entry, justUnlocked }: Props) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-2 border p-3 transition-all",
        entry.earned ? RARITY_CARD_ACCENT[entry.rarity] : "border-border/60 bg-muted/30",
        justUnlocked && "animate-in zoom-in-95 fade-in duration-500",
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("text-3xl", !entry.earned && "opacity-40 grayscale")}>{entry.icon}</span>
        {entry.earned ? (
          <Check className="size-4 text-emerald-500" />
        ) : (
          <Lock className="size-4 text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">{entry.name}</p>
        <span className={cn("mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium", RARITY_CLASSNAME[entry.rarity])}>
          {RARITY_LABEL[entry.rarity]}
        </span>
      </div>
      <p className="text-xs leading-snug text-muted-foreground">
        {entry.earned ? entry.description : entry.condition}
      </p>
      {entry.earned && entry.awardedAt && (
        <p className="mt-auto text-[11px] text-muted-foreground">Obtenu le {dateFormatter.format(entry.awardedAt)}</p>
      )}
    </Card>
  );
}
