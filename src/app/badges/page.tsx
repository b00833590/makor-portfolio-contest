import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getBadgeBoard } from "@/lib/gamification/get-badge-board";
import { getCachedPersonalRecords } from "@/lib/gamification/get-personal-records";
import { getUnseenBadges } from "@/lib/gamification/get-unseen-badges";
import { recordDailyVisit } from "@/lib/gamification/record-daily-visit";
import { SiteHeader } from "@/components/site-header";
import { UnseenBadgeToaster } from "@/components/badges/unseen-badge-toaster";
import { AutoRefresh } from "@/components/auto-refresh";
import { BadgesHeader } from "./badges-header";
import { PersonalRecordsSection } from "./personal-records-section";
import { BadgeGrid } from "./badge-grid";

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

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { promotionId: true } });
  if (!user?.promotionId) {
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

  const portfolio = await db.portfolio.findUnique({
    where: { userId_promotionId: { userId: session.user.id, promotionId: user.promotionId } },
    select: { id: true },
  });
  if (!portfolio) {
    return (
      <>
        {header}
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="text-sm text-muted-foreground">
            Votre portefeuille n&apos;a pas encore été créé par l&apos;administrateur.
          </p>
        </div>
      </>
    );
  }

  const [board, records, unseen] = await Promise.all([
    getBadgeBoard(session.user.id, user.promotionId),
    getCachedPersonalRecords(portfolio.id),
    getUnseenBadges(session.user.id, user.promotionId),
    recordDailyVisit(session.user.id),
  ]);

  const justUnlockedCodes = new Set(unseen.map((badge) => badge.code));

  return (
    <>
      {header}
      <UnseenBadgeToaster badges={unseen} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Badges</h1>

        <div className="mt-6">
          <BadgesHeader board={board} />
        </div>
        <BadgeGrid board={board} justUnlockedCodes={justUnlockedCodes} />
        <div className="mt-10">
          <PersonalRecordsSection records={records} />
        </div>
      </div>
    </>
  );
}
