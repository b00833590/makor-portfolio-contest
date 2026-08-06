import type { BadgeRarity } from "@/generated/prisma/enums";

export const XP_BY_RARITY: Record<BadgeRarity, number> = {
  COMMON: 10,
  RARE: 25,
  EPIC: 60,
  LEGENDARY: 150,
};

interface LevelTier {
  label: string;
  minXp: number;
}

/** Paliers nommés plutôt qu'un niveau par tranche de 100 XP — plus lisible et plus motivant sur
 * la durée d'un concours de quelques semaines que 20+ niveaux plats. */
const LEVEL_TIERS: LevelTier[] = [
  { label: "Débutant", minXp: 0 },
  { label: "Analyste", minXp: 50 },
  { label: "Trader confirmé", minXp: 150 },
  { label: "Stratège", minXp: 350 },
  { label: "Expert", minXp: 600 },
  { label: "Maître", minXp: 1000 },
  { label: "Légende du concours", minXp: 1500 },
];

export interface LevelInfo {
  level: number;
  label: string;
  xp: number;
  xpIntoLevel: number;
  /** XP nécessaire pour passer du palier courant au suivant ; `null` au dernier palier. */
  xpForNextLevel: number | null;
  /** 0-100 ; 100 au dernier palier (pas de "suivant" vers lequel progresser). */
  progressPct: number;
}

export function computeXp(badges: { rarity: BadgeRarity }[]): number {
  return badges.reduce((sum, badge) => sum + XP_BY_RARITY[badge.rarity], 0);
}

export function computeLevel(xp: number): LevelInfo {
  let tierIndex = 0;
  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    if (xp >= LEVEL_TIERS[i].minXp) tierIndex = i;
  }
  const tier = LEVEL_TIERS[tierIndex];
  const nextTier = LEVEL_TIERS[tierIndex + 1] ?? null;
  const xpIntoLevel = xp - tier.minXp;
  const xpForNextLevel = nextTier ? nextTier.minXp - tier.minXp : null;
  const progressPct = nextTier && xpForNextLevel ? Math.min(100, (xpIntoLevel / xpForNextLevel) * 100) : 100;

  return {
    level: tierIndex + 1,
    label: tier.label,
    xp,
    xpIntoLevel,
    xpForNextLevel,
    progressPct,
  };
}
