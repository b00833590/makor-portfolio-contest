import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getCachedLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getCachedParticipantStats } from "@/lib/gamification/get-participant-stats";
import { getCachedContestStats } from "@/lib/gamification/get-contest-stats";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ParticipantStatsSection } from "./participant-stats-section";
import { ContestStatsSection } from "./contest-stats-section";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function StatistiquesPage() {
  const session = await verifySession();
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  const header = (
    <>
      <AutoRefresh />
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
    </>
  );

  if (!user?.promotionId) {
    return (
      <>
        {header}
        <div className="mx-auto w-full max-w-5xl px-6 py-10">
          <p className="text-sm text-muted-foreground">Vous n&apos;êtes assigné à aucune promotion pour le moment.</p>
        </div>
      </>
    );
  }

  const leaderboard = await getCachedLeaderboard(user.promotionId);
  const ownRow = leaderboard.find((row) => row.userId === session.user.id);

  const [participantStats, contestStats] = await Promise.all([
    ownRow ? getCachedParticipantStats(ownRow.portfolioId, ownRow) : Promise.resolve(null),
    getCachedContestStats(user.promotionId, leaderboard),
  ]);

  return (
    <>
      {header}
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
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
