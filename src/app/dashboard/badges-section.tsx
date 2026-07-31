import type { EarnedBadge } from "@/lib/gamification/get-user-badges";

export function BadgesSection({ badges }: { badges: EarnedBadge[] }) {
  if (badges.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Aucun badge pour le moment — ils sont réévalués chaque jour.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {badges.map((badge) => (
        <div
          key={badge.code}
          title={badge.description}
          className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span className="text-base">{badge.icon}</span>
          <span className="font-medium">{badge.name}</span>
        </div>
      ))}
    </div>
  );
}
