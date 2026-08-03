import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { getPortfolioView } from "@/lib/trading/portfolio-view";
import { getPerformanceHistory } from "@/lib/trading/performance-history";
import { getTransactionHistory } from "@/lib/trading/transaction-history";
import { getUserBadges } from "@/lib/gamification/get-user-badges";
import { getOpenChangeSession } from "@/lib/trading/execute-order";
import { getClosingSoonNotice } from "@/lib/trading/change-session-notice";
import { ChangeSessionKind } from "@/generated/prisma/enums";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuyForm } from "./buy-form";
import { PositionCard } from "./position-card";
import { PerformanceChart } from "./performance-chart";
import { TransactionHistoryTable } from "./transaction-history-table";
import { BadgesSection } from "./badges-section";
import { InitializationWindowBanner } from "./initialization-window-banner";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function DashboardPage() {
  const session = await verifySession();
  // L'admin ne joue pas — pas de portefeuille, le panneau d'administration le remplace.
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }
  const portfolioView = await getPortfolioView(session.user.id);

  const [performanceHistory, transactionHistory, badges, openChangeSession] = portfolioView
    ? await Promise.all([
        getPerformanceHistory(portfolioView.portfolioId),
        getTransactionHistory(portfolioView.portfolioId),
        getUserBadges(session.user.id, portfolioView.promotionId),
        getOpenChangeSession(portfolioView.promotionId),
      ])
    : [[], [], [], null];

  const isInitializationWindow = openChangeSession?.kind === ChangeSessionKind.INITIALIZATION;
  const closingSoonNotice =
    openChangeSession && !isInitializationWindow ? getClosingSoonNotice(openChangeSession.closesAt, new Date()) : null;

  return (
    <>
      <SiteHeader
        name={session.user.name}
        role={session.user.role}
        avatarUrl={session.user.avatarUrl}
      />
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Mon portefeuille</h1>

        {isInitializationWindow && portfolioView && (
          <InitializationWindowBanner
            closesAt={openChangeSession.closesAt.toISOString()}
            investedAmount={portfolioView.initialCapital - portfolioView.availableCash}
            initialCapital={portfolioView.initialCapital}
          />
        )}

        {closingSoonNotice && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
            ⏰ {closingSoonNotice.message}
          </div>
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
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Évolution du portefeuille</CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceChart data={performanceHistory} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
              </CardHeader>
              <CardContent>
                <BadgesSection badges={badges} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Nouvel achat</CardTitle>
              </CardHeader>
              <CardContent>
                <BuyForm />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              {portfolioView.positions.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune position ouverte pour le moment.</p>
              )}
              {portfolioView.positions.map((position) => (
                <PositionCard key={position.assetId} position={position} />
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
