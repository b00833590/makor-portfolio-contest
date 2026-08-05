import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ChangeSessionKind, ChangeSessionStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { toParisDateTimeLocalValue, formatParisDateTime } from "@/lib/timezone";
import { ChangeSessionForm } from "./change-session-form";
import { ChangeSessionRowActions } from "./change-session-row-actions";
import { BulkParticipantsForm } from "./bulk-participants-form";
import { setChangeSessionStatus, recalculateAllSnapshots } from "./actions";

const statusLabels: Record<ChangeSessionStatus, string> = {
  SCHEDULED: "Planifiée",
  OPEN: "Ouverte",
  CLOSED: "Fermée",
};

export default async function PromotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const promotion = await db.promotion.findUnique({
    where: { id },
    include: {
      changeSessions: { orderBy: { weekNumber: "asc" } },
      users: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });

  if (!promotion) {
    notFound();
  }

  const rules = promotionRulesSchema.parse(promotion.rules);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/promotions" className="text-sm text-muted-foreground hover:underline">
          ← Promotions
        </Link>
        <div className="mt-1 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{promotion.name}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/promotions/${promotion.id}/parametres`} />}>
              Paramètres
            </Button>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/promotions/${promotion.id}/reglement`} />}>
              Règlement
            </Button>
            <form action={recalculateAllSnapshots.bind(null, promotion.id)}>
              <Button type="submit" variant="outline" size="sm">
                Recalculer tous les portefeuilles
              </Button>
            </form>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {promotion.startDate.toLocaleDateString("fr-FR")} → {promotion.endDate.toLocaleDateString("fr-FR")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {promotion.users.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {promotion.users.map((user) => (
                <li key={user.id}>
                  <Badge variant="secondary">{user.name}</Badge>
                </li>
              ))}
            </ul>
          )}
          <BulkParticipantsForm promotionId={promotion.id} />
          <Link href="/admin/participants" className="text-sm text-muted-foreground hover:underline">
            Gérer tous les participants →
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle session de changement</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeSessionForm promotionId={promotion.id} defaultMaxChanges={rules.maxChangesPerSession} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {promotion.changeSessions.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune session de changement pour le moment.</p>
        )}
        {promotion.changeSessions.map((changeSession) => {
          const isInitializationWindow = changeSession.kind === ChangeSessionKind.INITIALIZATION;
          return (
          <Card key={changeSession.id} className={isInitializationWindow ? "border-primary/50" : undefined}>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {isInitializationWindow ? "Fenêtre de constitution du portefeuille" : `Semaine ${changeSession.weekNumber}`}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatParisDateTime(changeSession.opensAt)} →{" "}
                  {formatParisDateTime(changeSession.closesAt)} ·{" "}
                  {isInitializationWindow ? "changements illimités" : `${changeSession.maxChangesPerParticipant} changements max`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isInitializationWindow && <Badge variant="outline">Initialisation</Badge>}
                <Badge variant={changeSession.status === "OPEN" ? "default" : "secondary"}>
                  {statusLabels[changeSession.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {changeSession.status === ChangeSessionStatus.SCHEDULED && (
                <form
                  action={setChangeSessionStatus.bind(null, promotion.id, changeSession.id, ChangeSessionStatus.OPEN)}
                >
                  <Button type="submit" variant="outline">
                    Ouvrir
                  </Button>
                </form>
              )}
              {changeSession.status === ChangeSessionStatus.OPEN && (
                <form
                  action={setChangeSessionStatus.bind(null, promotion.id, changeSession.id, ChangeSessionStatus.CLOSED)}
                >
                  <Button type="submit" variant="outline">
                    Fermer
                  </Button>
                </form>
              )}
              <ChangeSessionRowActions
                promotionId={promotion.id}
                changeSessionId={changeSession.id}
                kind={changeSession.kind}
                weekNumber={changeSession.weekNumber}
                opensAt={toParisDateTimeLocalValue(changeSession.opensAt)}
                closesAt={toParisDateTimeLocalValue(changeSession.closesAt)}
                maxChangesPerParticipant={changeSession.maxChangesPerParticipant}
              />
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
