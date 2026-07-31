import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { signOut } from "@/auth";
import { getPortfolioView } from "@/lib/trading/portfolio-view";
import { getPerformanceHistory } from "@/lib/trading/performance-history";
import { getTransactionHistory } from "@/lib/trading/transaction-history";
import { getUserBadges } from "@/lib/gamification/get-user-badges";
import { getOpenChangeSession } from "@/lib/trading/execute-order";
import { getClosingSoonNotice } from "@/lib/trading/change-session-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuyForm } from "./buy-form";
import { PositionCard } from "./position-card";
import { PerformanceChart } from "./performance-chart";
import { TransactionHistoryTable } from "./transaction-history-table";
import { BadgesSection } from "./badges-section";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function DashboardPage() {
  const session = await verifySession();
  const portfolioView = await getPortfolioView(session.user.id);

  const [availableAssets, performanceHistory, transactionHistory, badges, openChangeSession] = portfolioView
    ? await Promise.all([
        db.asset.findMany({
          where: {
            isActive: true,
            id: { notIn: portfolioView.positions.map((position) => position.assetId) },
          },
          select: { id: true, symbol: true, name: true },
          orderBy: { symbol: "asc" },
        }),
        getPerformanceHistory(portfolioView.portfolioId),
        getTransactionHistory(portfolioView.portfolioId),
        getUserBadges(session.user.id, portfolioView.promotionId),
        getOpenChangeSession(portfolioView.promotionId),
      ])
    : [[], [], [], [], null];

  const closingSoonNotice = openChangeSession
    ? getClosingSoonNotice(openChangeSession.closesAt, new Date())
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bienvenue, {session.user.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {session.user.email} · rôle {session.user.role}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/leaderboard" className="text-sm text-zinc-500 hover:underline">
            Classement →
          </Link>
          <form action={handleSignOut}>
            <Button variant="outline" type="submit">
              Se déconnecter
            </Button>
          </form>
        </div>
      </div>

      {closingSoonNotice && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          ⏰ {closingSoonNotice.message}
        </div>
      )}

      {!portfolioView && (
        <p className="mt-8 text-sm text-zinc-500">
          Vous n&apos;êtes pas encore assigné à une promotion, ou votre portefeuille n&apos;a pas
          encore été créé par l&apos;administrateur.
        </p>
      )}

      {portfolioView && (
        <div className="mt-8 flex flex-col gap-8">
          <div className="flex gap-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Capital disponible</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {currencyFormatter.format(portfolioView.availableCash)}
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Valeur investie</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {currencyFormatter.format(portfolioView.totalMarketValue)}
              </CardContent>
            </Card>
          </div>

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
              <CardTitle>Évolution du portefeuille</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart data={performanceHistory} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nouvel achat</CardTitle>
            </CardHeader>
            <CardContent>
              <BuyForm assets={availableAssets} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {portfolioView.positions.length === 0 && (
              <p className="text-sm text-zinc-500">Aucune position ouverte pour le moment.</p>
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
  );
}
