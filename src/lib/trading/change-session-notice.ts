export interface ClosingSoonNotice {
  hoursRemaining: number;
  message: string;
}

const DEFAULT_THRESHOLD_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

export function getClosingSoonNotice(
  closesAt: Date,
  now: Date,
  thresholdHours: number = DEFAULT_THRESHOLD_HOURS,
): ClosingSoonNotice | null {
  const msRemaining = closesAt.getTime() - now.getTime();
  if (msRemaining <= 0) return null;

  const hoursRemaining = msRemaining / HOUR_MS;
  if (hoursRemaining > thresholdHours) return null;

  const rounded = Math.max(1, Math.round(hoursRemaining));
  const message =
    hoursRemaining < 1
      ? "La session de changement ferme dans moins d'une heure !"
      : `La session de changement ferme dans ${rounded}h.`;

  return { hoursRemaining: rounded, message };
}
