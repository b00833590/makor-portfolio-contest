"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { BadgeBoard } from "@/lib/gamification/get-badge-board";
import { BadgesHeader } from "./badges-header";
import { BadgeGrid } from "./badge-grid";

export interface BadgeTab {
  /** promotionId, ou "all" pour la collection à vie. */
  value: string;
  label: string;
  board: BadgeBoard;
}

const NO_CODES: ReadonlySet<string> = new Set();

export function BadgesTabs({
  tabs,
  defaultValue,
  justUnlockedCodes,
}: {
  tabs: BadgeTab[];
  defaultValue: string;
  /** Badges tout juste débloqués — mis en avant uniquement dans l'onglet de la promotion active. */
  justUnlockedCodes: Set<string>;
}) {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList className="flex-wrap">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-6">
          <BadgesHeader board={tab.board} />
          <BadgeGrid
            board={tab.board}
            justUnlockedCodes={tab.value === defaultValue ? justUnlockedCodes : (NO_CODES as Set<string>)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
