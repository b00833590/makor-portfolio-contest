import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getCachedLeaderboard, getLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getCachedParticipantStats } from "@/lib/gamification/get-participant-stats";
import { getCachedContestStats } from "@/lib/gamification/get-contest-stats";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ParticipantStatsSection } from "./participant-stats-section";
import { ContestStatsSection } from "./contest-stats-section";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function StatistiquesPage() {
  const session = await verifySession();
  // L'admin ne joue pas — les statistiques personnelles ne le concernent pas, voir dashboard/page.tsx pour le même choix.
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  const promotion = user?.promotionId
    ? await db.promotion.findUnique({ where: { id: user.promotionId }, select: { status: true, endDate: true } })
    : null;
  const contestClosed = promotion?.status === PromotionStatus.CLOSED;

  const header = (
    <>
      {/* Concours terminé : tout est figé, aucun intérêt à repoller. */}
      {!contestClosed && <AutoRefresh />}
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
    </>
  );

  if (!user?.promotionId) {
    return (
      <>
        {header}
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="text-sm text-muted-foreground">Vous n&apos;êtes assigné à aucune promotion pour le moment.</p>
        </div>
      </>
    );
  }

  // Concours clos : classement valorisé au dernier cours <= endDate (aucun
  // rafraîchissement fournisseur), cohérent avec /resultats et le Hall of Fame.
  const leaderboard = contestClosed
    ? await getLeaderboard(user.promotionId, promotion!.endDate, { frozen: true })
    : await getCachedLeaderboard(user.promotionId);
  const ownRow = leaderboard.find((row) => row.userId === session.user.id);

  const [participantStats, contestStats] = await Promise.all([
    ownRow ? getCachedParticipantStats(ownRow.portfolioId, user.promotionId, ownRow) : Promise.resolve(null),
    getCachedContestStats(user.promotionId, leaderboard),
  ]);

  return (
    <>
      {header}
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Statistiques</h1>

        {participantStats ? (
          <Tabs defaultValue="mine" className="mt-6">
            <TabsList>
              <TabsTrigger value="mine">Mes statistiques</TabsTrigger>
              <TabsTrigger value="contest">Statistiques du concours</TabsTrigger>
            </TabsList>
            <TabsContent value="mine" className="mt-6">
              <ParticipantStatsSection stats={participantStats} />
            </TabsContent>
            <TabsContent value="contest" className="mt-6">
              <ContestStatsSection stats={contestStats} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="mt-6">
            <ContestStatsSection stats={contestStats} />
          </div>
        )}
      </div>
    </>
  );
}
