import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getParticipantStats } from "@/lib/gamification/get-participant-stats";
import { getContestStats } from "@/lib/gamification/get-contest-stats";
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
      {/* Stats agrégées ne changent qu'au rythme du snapshot nocturne : pas besoin du défaut 5 min. */}
      <AutoRefresh intervalMs={600_000} />
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

  const leaderboard = await getLeaderboard(user.promotionId);
  const ownRow = leaderboard.find((row) => row.userId === session.user.id);

  const [participantStats, contestStats] = await Promise.all([
    ownRow ? getParticipantStats(ownRow.portfolioId, ownRow) : Promise.resolve(null),
    getContestStats(user.promotionId, leaderboard),
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
