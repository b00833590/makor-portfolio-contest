import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCachedPortfolioView } from "@/lib/trading/portfolio-view";
import { getPerformanceHistory } from "@/lib/trading/performance-history";
import { getTransactionHistory } from "@/lib/trading/transaction-history";
import { PromotionStatus } from "@/generated/prisma/enums";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { PortfolioSummary } from "@/app/dashboard/portfolio-summary";
import { DirecteurBadgesSection } from "./badges-section";

export default async function DirecteurParticipantPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, avatarUrl: true, role: true },
  });
  if (!targetUser || targetUser.role !== "PARTICIPANT") {
    notFound();
  }

  const portfolioView = await getCachedPortfolioView(userId);
  const [performanceHistory, transactionHistory] = portfolioView
    ? await Promise.all([
        getPerformanceHistory(portfolioView.portfolioId),
        getTransactionHistory(portfolioView.portfolioId),
      ])
    : [[], []];

  const contestClosed = portfolioView?.promotionStatus === PromotionStatus.CLOSED;

  return (
    <>
      {portfolioView && !contestClosed && <AutoRefresh />}
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {portfolioView ? (
          <Link
            href={`/directeur/promotions/${portfolioView.promotionId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← {portfolioView.promotionName}
          </Link>
        ) : (
          <Link href="/directeur" className="text-sm text-muted-foreground hover:underline">
            ← Concours
          </Link>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <UserAvatar name={targetUser.name} avatarUrl={targetUser.avatarUrl} className="size-10" />
          <h1 className="text-2xl font-semibold tracking-tight">Portefeuille de {targetUser.name}</h1>
          <Badge variant="secondary">Lecture seule</Badge>
        </div>

        {portfolioView ? (
          <div className="mt-6">
            <PortfolioSummary
              portfolioView={portfolioView}
              performanceHistory={performanceHistory}
              transactionHistory={transactionHistory}
              contestClosed={Boolean(contestClosed)}
              readOnly
            />
          </div>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Ce participant n&apos;a pas de portefeuille actif pour le moment.
          </p>
        )}

        <div className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Badges</h2>
          <div className="mt-4">
            <DirecteurBadgesSection
              userId={userId}
              activePromotionId={portfolioView?.promotionId ?? null}
              activePromotionName={portfolioView?.promotionName ?? null}
            />
          </div>
        </div>
      </div>
    </>
  );
}
