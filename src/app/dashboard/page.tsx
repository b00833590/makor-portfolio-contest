import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { closePromotionIfEnded } from "@/lib/promotion-lifecycle";
import { getCachedPortfolioView } from "@/lib/trading/portfolio-view";
import { getPerformanceHistory } from "@/lib/trading/performance-history";
import { getTransactionHistory } from "@/lib/trading/transaction-history";
import { getUnseenBadges } from "@/lib/gamification/get-unseen-badges";
import { recordDailyVisit } from "@/lib/gamification/record-daily-visit";
import { getOpenChangeSession, getNextScheduledChangeSession, getChangesUsedCount } from "@/lib/trading/execute-order";
import { ChangeSessionKind, PromotionStatus } from "@/generated/prisma/enums";
import { SiteHeader } from "@/components/site-header";
import { UnseenBadgeToaster } from "@/components/badges/unseen-badge-toaster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuyForm } from "./buy-form";
import { PositionCard } from "./position-card";
import { PerformanceChart } from "./performance-chart";
import { TransactionHistoryTable } from "./transaction-history-table";
import { InitializationWindowBanner } from "./initialization-window-banner";
import { ChangeSessionStatusBanner } from "./change-session-status-banner";
import { AutoRefresh } from "@/components/auto-refresh";
import { ContestEndedBanner } from "@/components/contest-ended-banner";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function DashboardPage() {
  const session = await verifySession();
  // L'admin ne joue pas — pas de portefeuille, le panneau d'administration le remplace.
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { promotionId: true },
  });
  if (dbUser?.promotionId) {
    await closePromotionIfEnded(dbUser.promotionId);
  }

  const promotion = dbUser?.promotionId
    ? await db.promotion.findUnique({
        where: { id: dbUser.promotionId },
        select: { id: true, status: true },
      })
    : null;
  const contestClosed = promotion?.status === PromotionStatus.CLOSED;

  if (contestClosed) {
    const seen = (await cookies()).get(`seen_results_${promotion!.id}`);
    if (!seen) {
      redirect("/resultats");
    }
  }

  const [portfolioView] = await Promise.all([
    getCachedPortfolioView(session.user.id),
    recordDailyVisit(session.user.id),
  ]);

  const [performanceHistory, transactionHistory, unseenBadges, openChangeSession] = portfolioView
    ? await Promise.all([
        getPerformanceHistory(portfolioView.portfolioId),
        getTransactionHistory(portfolioView.portfolioId),
        getUnseenBadges(session.user.id, portfolioView.promotionId),
        getOpenChangeSession(portfolioView.promotionId),
      ])
    : [[], [], [], null];

  const isInitializationWindow = openChangeSession?.kind === ChangeSessionKind.INITIALIZATION;
  const weeklySessionOpen = openChangeSession && !isInitializationWindow ? openChangeSession : null;
  const nextChangeSession =
    portfolioView && !openChangeSession ? await getNextScheduledChangeSession(portfolioView.promotionId) : null;
  const changesUsed = weeklySessionOpen
    ? await getChangesUsedCount(weeklySessionOpen.id, session.user.id)
    : undefined;

  return (
    <>
      {!contestClosed && <AutoRefresh />}
      <SiteHeader
        name={session.user.name}
        role={session.user.role}
        avatarUrl={session.user.avatarUrl}
      />
      <UnseenBadgeToaster badges={unseenBadges} />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Mon portefeuille</h1>

        {contestClosed && <ContestEndedBanner />}

        {!contestClosed && isInitializationWindow && portfolioView && (
          <InitializationWindowBanner
            closesAt={openChangeSession.closesAt.toISOString()}
            investedAmount={portfolioView.initialCapital - portfolioView.availableCash}
            initialCapital={portfolioView.initialCapital}
          />
        )}

        {!contestClosed && weeklySessionOpen && (
          <ChangeSessionStatusBanner
            status="OPEN"
            opensAt={weeklySessionOpen.opensAt.toISOString()}
            closesAt={weeklySessionOpen.closesAt.toISOString()}
            changesUsed={changesUsed}
            maxChangesPerParticipant={weeklySessionOpen.maxChangesPerParticipant}
          />
        )}

        {!contestClosed && !isInitializationWindow && !weeklySessionOpen && nextChangeSession && (
          <ChangeSessionStatusBanner
            status="UPCOMING"
            opensAt={nextChangeSession.opensAt.toISOString()}
            closesAt={nextChangeSession.closesAt.toISOString()}
          />
        )}

        {!contestClosed &&
          !isInitializationWindow &&
          !weeklySessionOpen &&
          !nextChangeSession &&
          portfolioView && (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune session de changement n&apos;est prévue pour le moment — votre portefeuille est verrouillé.
            </p>
          )}

        {!portfolioView && (
          <p className="mt-8 text-sm text-muted-foreground">
            Vous n&apos;êtes pas encore assigné à une promotion, ou votre portefeuille n&apos;a pas
            encore été créé par l&apos;administrateur.
          </p>
        )}

        {portfolioView && (
          <div className="mt-6 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Capital initial</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {currencyFormatter.format(portfolioView.initialCapital)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Capital disponible</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {currencyFormatter.format(portfolioView.availableCash)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Valeur investie</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {currencyFormatter.format(portfolioView.totalMarketValue)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Valeur du portefeuille</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {currencyFormatter.format(portfolioView.totalValue)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Performance totale</CardTitle>
                </CardHeader>
                <CardContent
                  className={`text-2xl font-semibold tabular-nums ${portfolioView.totalGainPct >= 0 ? "text-gain" : "text-loss"}`}
                >
                  {portfolioView.totalGainPct >= 0 ? "+" : ""}
                  {portfolioView.totalGainPct.toFixed(1)}%
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    ({portfolioView.totalGainEur >= 0 ? "+" : ""}
                    {currencyFormatter.format(portfolioView.totalGainEur)})
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Positions</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold tabular-nums">
                  {portfolioView.positions.length}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    / {portfolioView.maxPositions}
                  </span>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Évolution du portefeuille</CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceChart data={performanceHistory} />
              </CardContent>
            </Card>

            {!contestClosed && (
              <Card>
                <CardHeader>
                  <CardTitle>Nouvel achat</CardTitle>
                </CardHeader>
                <CardContent>
                  <BuyForm contestClosed={contestClosed} />
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-4">
              {portfolioView.positions.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune position ouverte pour le moment.</p>
              )}
              {portfolioView.positions.map((position) => (
                <PositionCard key={position.assetId} position={position} contestClosed={contestClosed} />
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Historique des transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <TransactionHistoryTable transactions={transactionHistory} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
