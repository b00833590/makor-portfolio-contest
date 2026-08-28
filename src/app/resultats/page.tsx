import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getFrozenLeaderboard } from "@/lib/gamification/frozen-leaderboard";
import { finalizePromotionClosure } from "@/lib/promotion-lifecycle";
import { formatParisDateTimeLong } from "@/lib/timezone";
import { SiteHeader } from "@/components/site-header";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResultsPodium } from "./results-podium";
import { ResultsPending } from "./results-pending";

const formatPct = (value: number): string => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
const eurFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const perfClassName = (value: number): string =>
  cn("text-lg font-semibold tabular-nums", value >= 0 ? "text-gain" : "text-loss");

export default async function ResultatsPage() {
  const session = await verifySession();
  if (session.user.role === "ADMIN") redirect("/admin");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { promotionId: true },
  });
  if (!user?.promotionId) redirect("/dashboard");

  const promotion = await db.promotion.findUnique({
    where: { id: user.promotionId },
    select: { id: true, name: true, endDate: true, status: true },
  });
  if (!promotion || promotion.status !== PromotionStatus.CLOSED) redirect("/dashboard");

  let rows = await getFrozenLeaderboard(promotion.id);
  if (rows.length === 0) {
    // Clôture committée mais finalisation interrompue/concurrente — rejouable sans effet.
    await finalizePromotionClosure(promotion.id).catch(() => {});
    rows = await getFrozenLeaderboard(promotion.id);
  }
  if (rows.length === 0) {
    // Toujours vide : afficher un état d'attente, ne PAS rediriger (boucle), ne PAS marquer "vu".
    return (
      <ResultsPending
        promotionName={promotion.name}
        userName={session.user.name}
        role={session.user.role}
        avatarUrl={session.user.avatarUrl}
      />
    );
  }

  const winner = rows[0];
  const me = rows.find((row) => row.userId === session.user.id) ?? null;
  const podium = rows.slice(0, 3).map((row) => ({
    userName: row.userName,
    avatarUrl: row.avatarUrl,
    finalRank: row.finalRank,
    finalReturnPct: row.finalReturnPct,
    isSelf: row.userId === session.user.id,
  }));

  return (
    <>
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-14">
        <p className="text-center text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          {promotion.name} · terminé le {formatParisDateTimeLong(promotion.endDate)}
        </p>
        <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          🏆 Concours terminé
        </h1>

        <Card className="mt-8 border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-center">Vainqueur</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-1 text-center">
            <UserAvatar
              name={winner.userName}
              avatarUrl={winner.avatarUrl}
              className="size-16"
              fallbackClassName="text-lg"
            />
            <p className="mt-1 text-xl font-semibold">{winner.userName}</p>
            <p className={perfClassName(winner.finalReturnPct)}>
              {formatPct(winner.finalReturnPct)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({eurFormatter.format(winner.finalPnlEur)})
              </span>
            </p>
          </CardContent>
        </Card>

        <div className="mt-8">
          <ResultsPodium promotionId={promotion.id} entries={podium} />
        </div>

        {me && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Votre résultat</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserAvatar name={me.userName} avatarUrl={me.avatarUrl} size="sm" className="shrink-0" />
                <span>
                  {me.finalRank}
                  <sup>{me.finalRank === 1 ? "er" : "e"}</sup> sur {rows.length}
                </span>
              </span>
              <span className={perfClassName(me.finalReturnPct)}>
                {formatPct(me.finalReturnPct)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({eurFormatter.format(me.finalPnlEur)})
                </span>
              </span>
            </CardContent>
          </Card>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Classement final</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 pt-2">
            {rows.map((row) => (
              <div
                key={row.finalRank}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2",
                  row.userId === session.user.id && "rounded-lg bg-muted/50 font-medium",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-center tabular-nums text-muted-foreground">
                    {row.finalRank}
                  </span>
                  <UserAvatar name={row.userName} avatarUrl={row.avatarUrl} size="sm" className="shrink-0" />
                  <span className="min-w-0 truncate">{row.userName}</span>
                </span>
                <span className={cn("tabular-nums", row.finalReturnPct >= 0 ? "text-gain" : "text-loss")}>
                  {formatPct(row.finalReturnPct)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Retour à mon portefeuille
          </Link>
        </div>
      </div>
    </>
  );
}
