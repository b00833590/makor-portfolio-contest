import { getBadgeBoard } from "@/lib/gamification/get-badge-board";
import { BadgesTabs, type BadgeTab } from "@/app/badges/badges-tabs";

/**
 * Deux onglets seulement (saison en cours + collection à vie), pas un onglet
 * par saison passée comme sur `/badges` — le Directeur suit l'état actuel
 * d'un participant, pas son historique saison par saison, et sans les
 * records personnels (propres au participant lui-même).
 */
export async function DirecteurBadgesSection({
  userId,
  activePromotionId,
  activePromotionName,
}: {
  userId: string;
  activePromotionId: string | null;
  activePromotionName: string | null;
}) {
  const [activeBoard, lifetimeBoard] = await Promise.all([
    activePromotionId ? getBadgeBoard(userId, activePromotionId) : Promise.resolve(null),
    getBadgeBoard(userId),
  ]);

  const tabs: BadgeTab[] = [
    ...(activeBoard && activePromotionName
      ? [{ value: activePromotionId!, label: activePromotionName, board: activeBoard }]
      : []),
    { value: "all", label: "Toutes saisons", board: lifetimeBoard },
  ];

  return <BadgesTabs tabs={tabs} defaultValue={tabs[0].value} justUnlockedCodes={new Set()} />;
}
