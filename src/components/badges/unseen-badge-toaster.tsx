"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { acknowledgeBadges } from "@/lib/gamification/badge-actions";
import { RARITY_LABEL } from "@/lib/gamification/badge-display";
import type { UnseenBadge } from "@/lib/gamification/get-unseen-badges";

/** Affiche un toast pour chaque badge attribué par le cron nocturne et jamais encore vu, puis les
 * marque comme vus — ne rend rien à l'écran, à monter une fois par page où des badges peuvent
 * être consultés (/dashboard, /badges). */
export function UnseenBadgeToaster({ badges }: { badges: UnseenBadge[] }) {
  const acknowledged = useRef(false);

  useEffect(() => {
    if (acknowledged.current || badges.length === 0) return;
    acknowledged.current = true;

    for (const badge of badges) {
      toast.success(`Badge débloqué : ${badge.name}`, {
        description: RARITY_LABEL[badge.rarity],
      });
    }
    void acknowledgeBadges(badges.map((badge) => badge.code));
  }, [badges]);

  return null;
}
