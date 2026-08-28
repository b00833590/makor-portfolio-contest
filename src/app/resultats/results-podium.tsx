"use client";

import { useEffect } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { markResultsSeen } from "./mark-seen";

const medals = ["🥇", "🥈", "🥉"];
const formatPct = (value: number): string => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export interface PodiumEntry {
  userName: string;
  avatarUrl: string | null;
  finalRank: number;
  finalReturnPct: number;
  isSelf: boolean;
}

/**
 * Podium 3 places (2e — 1er — 3e visuellement), apparition en cascade désactivée
 * si prefers-reduced-motion. Monte aussi le marqueur « résultats vus » : le
 * cookie ne peut pas être posé pendant le rendu RSC de la page, on le fait donc
 * depuis cet effet client via une server action.
 */
export function ResultsPodium({ promotionId, entries }: { promotionId: string; entries: PodiumEntry[] }) {
  useEffect(() => {
    void markResultsSeen(promotionId).catch(() => {});
  }, [promotionId]);

  const visualOrder = [entries[1], entries[0], entries[2]].filter(Boolean);

  return (
    <div className="grid grid-cols-3 items-end gap-3">
      {visualOrder.map((entry, index) => {
        const place = entry.finalRank;
        return (
          <div
            key={entry.finalRank}
            style={{ animationDelay: `${index * 140}ms` }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-4 text-center",
              "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500 motion-safe:fill-mode-backwards",
              place === 1 ? "border-primary/50 bg-primary/5 pb-8" : "pb-4",
              entry.isSelf && "ring-1 ring-primary",
            )}
          >
            <span className="text-3xl">{medals[place - 1]}</span>
            <UserAvatar
              name={entry.userName}
              avatarUrl={entry.avatarUrl}
              className={cn("mt-1", place === 1 ? "size-14" : "size-11")}
              fallbackClassName="text-base"
            />
            <p className="mt-1 text-sm font-medium">{entry.userName}</p>
            <p
              className={cn(
                "text-base font-semibold tabular-nums",
                entry.finalReturnPct >= 0 ? "text-gain" : "text-loss",
              )}
            >
              {formatPct(entry.finalReturnPct)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
