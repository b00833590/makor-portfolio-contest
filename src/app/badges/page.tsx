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

  // Collection à vie : tous les badges obtenus par le participant, quelle que
  // soit la promotion. Reste visible même entre deux saisons.
  const [board] = await Promise.all([
    getBadgeBoard(session.user.id),
    recordDailyVisit(session.user.id),
  ]);

  const portfolio = user?.promotionId
    ? await db.portfolio.findUnique({
        where: { userId_promotionId: { userId: session.user.id, promotionId: user.promotionId } },
        select: { id: true },
      })
    : null;

  // Records personnels et notifications de déblocage sont liés à une promotion
  // active en cours : on ne les affiche que si le participant en a une.
  const [records, unseen] =
    user?.promotionId && portfolio
      ? await Promise.all([
          getCachedPersonalRecords(portfolio.id),
          getUnseenBadges(session.user.id, user.promotionId),
        ])
      : [null, []];

  // Rien à montrer : aucun badge à vie ET pas de portefeuille dans une promotion
  // en cours. Sinon on affiche toujours la collection (badges obtenus + catalogue).
  if (board.earnedCount === 0 && !portfolio) {
    return (
      <>
        {header}
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="text-sm text-muted-foreground">
            {user?.promotionId
              ? "Votre portefeuille n'a pas encore été créé par l'administrateur."
              : "Vous n'êtes pas encore assigné à une promotion pour le moment."}
          </p>
        </div>
      </>
    );
  }

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
        {records && (
          <div className="mt-10">
            <PersonalRecordsSection records={records} />
          </div>
        )}
      </div>
    </>
  );
}
