"use client";

import { useEffect, useRef } from "react";
import { showBadgeUnlockToasts } from "@/components/badges/badge-unlock-toast";
import type { TradeFormState } from "./actions";

/** Affiche un toast de déblocage pour chaque nouveau badge renvoyé par une action de trading —
 * dédupliqué par code pour ne jamais répéter un toast déjà montré depuis le montage. */
export function useBadgeToast(state: TradeFormState): void {
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = (state.newBadges ?? []).filter((badge) => !shown.current.has(badge.code));
    if (fresh.length === 0) return;
    for (const badge of fresh) shown.current.add(badge.code);
    showBadgeUnlockToasts(fresh);
  }, [state.newBadges]);
}
