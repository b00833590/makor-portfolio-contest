"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RARITY_LABEL } from "@/lib/gamification/badge-display";
import type { TradeFormState } from "./actions";

/** Affiche un toast de déblocage pour chaque nouveau badge renvoyé par une action de trading —
 * dédupliqué par code pour ne jamais répéter un toast déjà montré depuis le montage du composant
 * (utile puisque `state` peut être le même objet stable entre deux re-rendus sans nouvelle
 * soumission de formulaire). */
export function useBadgeToast(state: TradeFormState): void {
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const badge of state.newBadges ?? []) {
      if (shown.current.has(badge.code)) continue;
      shown.current.add(badge.code);
      toast.success(`Badge débloqué : ${badge.name}`, {
        description: RARITY_LABEL[badge.rarity],
      });
    }
  }, [state.newBadges]);
}
