"use client";

import { useEffect, useRef } from "react";
import { acknowledgeBadges } from "@/lib/gamification/badge-actions";
import { showBadgeUnlockToasts } from "./badge-unlock-toast";
import type { UnseenBadge } from "@/lib/gamification/get-unseen-badges";

/** Affiche un toast pour chaque badge attribué par le cron nocturne et jamais encore vu, puis
 * les marque comme vus — ne rend rien à l'écran. À monter une fois par page où des badges
 * peuvent être consultés (/dashboard, /badges). */
export function UnseenBadgeToaster({ badges }: { badges: UnseenBadge[] }) {
  const acknowledged = useRef(false);

  useEffect(() => {
    if (acknowledged.current || badges.length === 0) return;
    acknowledged.current = true;

    showBadgeUnlockToasts(badges);
    void acknowledgeBadges(badges.map((badge) => badge.code));
  }, [badges]);

  return null;
}
