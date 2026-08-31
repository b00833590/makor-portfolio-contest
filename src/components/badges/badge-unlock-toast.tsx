"use client";

import { toast } from "sonner";
import { RARITY_LABEL } from "@/lib/gamification/badge-display";
import type { BadgeRarity } from "@/generated/prisma/enums";

export interface UnlockToastBadge {
  code: string;
  name: string;
  rarity: BadgeRarity;
  icon: string;
  description: string;
}

const ACCENT: Record<BadgeRarity, string> = {
  COMMON: "border-l-border",
  RARE: "border-l-blue-500",
  EPIC: "border-l-violet-500",
  LEGENDARY: "border-l-amber-500",
};

function isFlashy(rarity: BadgeRarity): boolean {
  return rarity === "EPIC" || rarity === "LEGENDARY";
}

function BadgeToastCard({ badge }: { badge: UnlockToastBadge }) {
  return (
    <a
      href="/badges"
      className={`flex w-[340px] max-w-[86vw] items-start gap-3 rounded-lg border border-l-4 ${ACCENT[badge.rarity]} bg-popover p-3 text-popover-foreground shadow-lg ${
        isFlashy(badge.rarity) ? "ring-1 ring-amber-500/20" : ""
      }`}
    >
      <span className="text-3xl leading-none">{badge.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          🏆 Badge débloqué · {RARITY_LABEL[badge.rarity]}
        </p>
        <p className="truncate text-sm font-semibold">{badge.name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{badge.description}</p>
      </div>
      <span className="ml-auto shrink-0 self-center text-xs text-muted-foreground">Voir →</span>
    </a>
  );
}

function BadgeSummaryToastCard({ badges }: { badges: UnlockToastBadge[] }) {
  return (
    <a
      href="/badges"
      className="flex w-[340px] max-w-[86vw] items-center gap-3 rounded-lg border border-l-4 border-l-amber-500 bg-popover p-3 text-popover-foreground shadow-lg"
    >
      <span className="text-2xl leading-none">🏆</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{badges.length} nouveaux badges !</p>
        <p className="mt-0.5 truncate text-lg leading-none">{badges.map((b) => b.icon).join(" ")}</p>
      </div>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">Voir →</span>
    </a>
  );
}

/** Affiche les toasts de déblocage : ≤ 2 badges → un toast chacun ; ≥ 3 → un toast récap. */
export function showBadgeUnlockToasts(badges: UnlockToastBadge[]): void {
  if (badges.length === 0) return;
  if (badges.length >= 3) {
    toast.custom(() => <BadgeSummaryToastCard badges={badges} />, { duration: 7000 });
    return;
  }
  for (const badge of badges) {
    toast.custom(() => <BadgeToastCard badge={badge} />, { duration: isFlashy(badge.rarity) ? 7000 : 5000 });
  }
}
