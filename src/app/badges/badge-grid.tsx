"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RARITY_LABEL, RARITY_ORDER } from "@/lib/gamification/badge-display";
import { BadgeCard } from "./badge-card";
import type { BadgeBoard } from "@/lib/gamification/get-badge-board";
import type { BadgeRarity } from "@/generated/prisma/enums";

type OwnershipFilter = "ALL" | "EARNED" | "LOCKED";
type Props = { board: BadgeBoard; justUnlockedCodes: Set<string> };

export function BadgeGrid({ board, justUnlockedCodes }: Props) {
  const [ownership, setOwnership] = useState<OwnershipFilter>("ALL");
  const [rarity, setRarity] = useState<BadgeRarity | null>(null);

  const matches = (earned: boolean, entryRarity: BadgeRarity) => {
    if (ownership === "EARNED" && !earned) return false;
    if (ownership === "LOCKED" && earned) return false;
    if (rarity !== null && entryRarity !== rarity) return false;
    return true;
  };

  return (
    <div className="mt-6 flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "EARNED", "LOCKED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setOwnership(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              ownership === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {value === "ALL" ? "Tous" : value === "EARNED" ? "Débloqués" : "À débloquer"}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {RARITY_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRarity(rarity === value ? null : value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              rarity === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {RARITY_LABEL[value]}
          </button>
        ))}
      </div>

      {board.byCategory.map((group) => {
        const visible = group.entries.filter((entry) => matches(entry.earned, entry.rarity));
        if (visible.length === 0) return null;
        return (
          <section key={group.category}>
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-sm font-semibold">
                {group.icon} {group.label}
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {group.earned} / {group.total}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((entry) => (
                <BadgeCard key={entry.code} entry={entry} justUnlocked={justUnlockedCodes.has(entry.code)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
