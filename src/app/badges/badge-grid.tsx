"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CATEGORY_LABEL } from "@/lib/gamification/badge-display";
import { BadgeCard } from "./badge-card";
import type { BadgeBoardEntry } from "@/lib/gamification/get-badge-board";
import type { BadgeCategory } from "@/generated/prisma/enums";

const CATEGORY_ORDER: BadgeCategory[] = [
  "PERFORMANCE",
  "TRADING",
  "RISK_MANAGEMENT",
  "CONVICTION",
  "DIVERSIFICATION",
  "RANKING",
  "SPECIAL_EVENT",
  "DISTINCTION",
];

export function BadgeGrid({
  entries,
  justUnlockedCodes,
}: {
  entries: BadgeBoardEntry[];
  justUnlockedCodes: Set<string>;
}) {
  return (
    <Tabs defaultValue="ALL" className="mt-6">
      <TabsList className="flex-wrap">
        <TabsTrigger value="ALL">Tous</TabsTrigger>
        {CATEGORY_ORDER.map((category) => (
          <TabsTrigger key={category} value={category}>
            {CATEGORY_LABEL[category]}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="ALL" className="mt-6">
        <BadgeCardGrid entries={entries} justUnlockedCodes={justUnlockedCodes} />
      </TabsContent>
      {CATEGORY_ORDER.map((category) => (
        <TabsContent key={category} value={category} className="mt-6">
          <BadgeCardGrid
            entries={entries.filter((entry) => entry.category === category)}
            justUnlockedCodes={justUnlockedCodes}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function BadgeCardGrid({
  entries,
  justUnlockedCodes,
}: {
  entries: BadgeBoardEntry[];
  justUnlockedCodes: Set<string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {entries.map((entry) => (
        <BadgeCard key={entry.code} entry={entry} justUnlocked={justUnlockedCodes.has(entry.code)} />
      ))}
    </div>
  );
}
