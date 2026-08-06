import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RARITY_LABEL, RARITY_CLASSNAME } from "@/lib/gamification/badge-display";
import { cn } from "@/lib/utils";
import type { BadgeBoardEntry } from "@/lib/gamification/get-badge-board";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export function BadgeCard({ entry, justUnlocked }: { entry: BadgeBoardEntry; justUnlocked: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Card
            className={cn(
              "flex flex-col items-center gap-2 p-4 text-center transition-all",
              !entry.earned && "grayscale opacity-50",
              justUnlocked && "animate-in zoom-in-95 fade-in duration-500",
            )}
          />
        }
      >
        <div className="relative">
          <span className="text-4xl">{entry.icon}</span>
          {!entry.earned && (
            <Lock className="absolute -right-1 -bottom-1 size-4 rounded-full bg-background p-0.5 text-muted-foreground" />
          )}
        </div>
        <p className="text-sm font-medium">{entry.name}</p>
        <Badge variant="outline" className={RARITY_CLASSNAME[entry.rarity]}>
          {RARITY_LABEL[entry.rarity]}
        </Badge>
        {entry.earned && entry.awardedAt && (
          <p className="text-xs text-muted-foreground">{dateFormatter.format(entry.awardedAt)}</p>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="flex max-w-56 flex-col gap-1 text-center">
        <p className="font-medium">{entry.earned ? entry.description : entry.condition}</p>
        {!entry.earned && <p className="text-muted-foreground">Non débloqué</p>}
      </TooltipContent>
    </Tooltip>
  );
}
