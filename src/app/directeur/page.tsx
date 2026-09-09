import Link from "next/link";
import { requireDirecteur } from "@/lib/dal";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { formatTimeRemaining } from "@/lib/format-duration";
import { formatParisDate } from "@/lib/timezone";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParticipantQuickSelect, type QuickSelectParticipant } from "./participant-quick-select";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function DirecteurHomePage() {
  await requireDirecteur();

  const [activePromotions, closedPromotions, activeParticipants] = await Promise.all([
    db.promotion.findMany({
      where: { status: PromotionStatus.ACTIVE },
      orderBy: { startDate: "asc" },
      include: { _count: { select: { participants: true } } },
    }),
    db.promotion.findMany({
      where: { status: PromotionStatus.CLOSED },
      orderBy: { endDate: "desc" },
      include: { _count: { select: { participants: true } } },
    }),
    db.promotionParticipant.findMany({
      where: { promotion: { status: PromotionStatus.ACTIVE } },
      select: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        promotion: { select: { name: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const quickSelectParticipants: QuickSelectParticipant[] = activeParticipants.map((participation) => ({
    id: participation.user.id,
    name: participation.user.name,
    avatarUrl: participation.user.avatarUrl,
    promotionName: participation.promotion.name,
  }));

  return (
    <>
      <AutoRefresh />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Espace Directeur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suivi en direct des concours Makor — consultation uniquement.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-6">
            <section>
              <h2 className="text-lg font-semibold">Concours en cours</h2>
              {activePromotions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aucun concours en cours pour le moment.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  {activePromotions.map((promotion) => (
                    <Link key={promotion.id} href={`/directeur/promotions/${promotion.id}`}>
                      <Card className="transition-colors hover:border-primary/40">
                        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                          <CardTitle>{promotion.name}</CardTitle>
                          <Badge>{formatTimeRemaining(promotion.endDate)}</Badge>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>{promotion._count.participants} participant(s)</span>
                          <span>Capital initial {currencyFormatter.format(Number(promotion.initialCapital))}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold">Historique</h2>
              {closedPromotions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aucun concours terminé pour le moment.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  {closedPromotions.map((promotion) => (
                    <Link key={promotion.id} href={`/directeur/promotions/${promotion.id}`}>
                      <Card className="transition-colors hover:border-primary/40">
                        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 py-4">
                          <CardTitle className="text-base">{promotion.name}</CardTitle>
                          <span className="text-xs text-muted-foreground">
                            Terminé le {formatParisDate(promotion.endDate)} · {promotion._count.participants} participant(s)
                          </span>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Accès rapide à un participant</h2>
            <div className="mt-4">
              <ParticipantQuickSelect participants={quickSelectParticipants} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
