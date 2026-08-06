import "server-only";
import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

function truncateToUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Enregistre la visite du jour et met à jour la série de connexions consécutives — no-op si
 * l'utilisateur a déjà été vu aujourd'hui (au plus une écriture par jour et par utilisateur, donc
 * un coût négligeable même appelé à chaque chargement de `/dashboard` ou `/badges`).
 */
export async function recordDailyVisit(userId: string, now: Date = new Date()): Promise<void> {
  const today = truncateToUtcDate(now);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { lastVisitDate: true, currentStreakDays: true, longestStreakDays: true },
  });
  if (!user) return;

  const lastVisit = user.lastVisitDate ? truncateToUtcDate(user.lastVisitDate) : null;
  if (lastVisit && lastVisit.getTime() === today.getTime()) return;

  const isConsecutiveDay = lastVisit !== null && today.getTime() - lastVisit.getTime() === DAY_MS;
  const currentStreakDays = isConsecutiveDay ? user.currentStreakDays + 1 : 1;
  const longestStreakDays = Math.max(user.longestStreakDays, currentStreakDays);

  await db.user.update({
    where: { id: userId },
    data: { lastVisitDate: today, currentStreakDays, longestStreakDays },
  });
}
