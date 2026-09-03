import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getBadgeBoard } from "@/lib/gamification/get-badge-board";
import { getParticipantPromotions } from "@/lib/gamification/get-participant-promotions";
import { getCachedPersonalRecords } from "@/lib/gamification/get-personal-records";
import { getUnseenBadges } from "@/lib/gamification/get-unseen-badges";
import { recordDailyVisit } from "@/lib/gamification/record-daily-visit";
import { SiteHeader } from "@/components/site-header";
import { UnseenBadgeToaster } from "@/components/badges/unseen-badge-toaster";
import { AutoRefresh } from "@/components/auto-refresh";
import { BadgesTabs, type BadgeTab } from "./badges-tabs";
import { PersonalRecordsSection } from "./personal-records-section";

function tabLabel(promotionName: string): string {
  return promotionName.replace(/^Promotion\s+/i, "");
}

export default async function BadgesPage() {
  const session = await verifySession();
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }

  const header = (
    <>
      <AutoRefresh />
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
    </>
  );

  const [user, promotions] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { promotionId: true } }),
    getParticipantPromotions(session.user.id),
    recordDailyVisit(session.user.id),
  ]);
  const activePromotionId = user?.promotionId ?? null;

  const [promotionBoards, lifetimeBoard] = await Promise.all([
    Promise.all(promotions.map((promotion) => getBadgeBoard(session.user.id, promotion.id))),
    getBadgeBoard(session.user.id),
  ]);

  // Rien du tout : ni inscription, ni badge → message d'attente.
  if (promotions.length === 0 && lifetimeBoard.earnedCount === 0) {
    return (
      <>
        {header}
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="text-sm text-muted-foreground">
            Vous n&apos;êtes pas encore assigné à une promotion pour le moment.
          </p>
        </div>
      </>
    );
  }

  const tabs: BadgeTab[] = [
    ...promotions.map((promotion, index) => ({
      value: promotion.id,
      label: tabLabel(promotion.name),
      board: promotionBoards[index],
    })),
    { value: "all", label: "Toutes saisons", board: lifetimeBoard },
  ];
  const defaultValue =
    activePromotionId && promotions.some((promotion) => promotion.id === activePromotionId)
      ? activePromotionId
      : (promotions[0]?.id ?? "all");

  // Records personnels + notifications de déblocage : liés à la promotion active en cours.
  let records = null;
  let unseen: Awaited<ReturnType<typeof getUnseenBadges>> = [];
  if (activePromotionId) {
    const portfolio = await db.portfolio.findUnique({
      where: { userId_promotionId: { userId: session.user.id, promotionId: activePromotionId } },
      select: { id: true },
    });
    if (portfolio) {
      [records, unseen] = await Promise.all([
        getCachedPersonalRecords(portfolio.id),
        getUnseenBadges(session.user.id, activePromotionId),
      ]);
    }
  }
  const justUnlockedCodes = new Set(unseen.map((badge) => badge.code));

  return (
    <>
      {header}
      <UnseenBadgeToaster badges={unseen} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Badges</h1>

        <div className="mt-6">
          <BadgesTabs tabs={tabs} defaultValue={defaultValue} justUnlockedCodes={justUnlockedCodes} />
        </div>

        {records && (
          <div className="mt-10">
            <PersonalRecordsSection records={records} />
          </div>
        )}
      </div>
    </>
  );
}
