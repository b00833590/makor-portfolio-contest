import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ChangeSessionKind } from "@/generated/prisma/enums";
import { formatParisDate } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { toParisDateTimeLocalValue, formatParisDateTime } from "@/lib/timezone";
import { computeChangeSessionStatus } from "@/lib/trading/change-session-status";
import { ChangeSessionForm } from "./change-session-form";
import { ChangeSessionsList, type ChangeSessionViewModel } from "./change-sessions-list";
import { BulkParticipantsForm } from "./bulk-participants-form";
import { recalculateAllSnapshots } from "./actions";

function formatDuration(opensAt: Date, closesAt: Date): string {
  const totalMinutes = Math.round((closesAt.getTime() - opensAt.getTime()) / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export default async function PromotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const promotion = await db.promotion.findUnique({
    where: { id },
    include: {
      changeSessions: { orderBy: { opensAt: "asc" } },
      users: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });

  if (!promotion) {
    notFound();
  }

  const rules = promotionRulesSchema.parse(promotion.rules);
  const now = new Date();
  const sessionViewModels: ChangeSessionViewModel[] = promotion.changeSessions.map((changeSession) => ({
    id: changeSession.id,
    kind: changeSession.kind,
    effectiveStatus: computeChangeSessionStatus(changeSession, now),
    label:
      changeSession.kind === ChangeSessionKind.INITIALIZATION
        ? "Fenêtre de constitution du portefeuille"
        : `Session du ${formatParisDate(changeSession.opensAt)}`,
    windowLabel: `${formatParisDateTime(changeSession.opensAt)} → ${formatParisDateTime(changeSession.closesAt)}`,
    durationLabel: formatDuration(changeSession.opensAt, changeSession.closesAt),
    opensAtLocal: toParisDateTimeLocalValue(changeSession.opensAt),
    closesAtLocal: toParisDateTimeLocalValue(changeSession.closesAt),
    maxChangesPerParticipant: changeSession.maxChangesPerParticipant,
  }));

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
          {formatParisDate(promotion.startDate)} → {formatParisDate(promotion.endDate)}
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

      <ChangeSessionsList promotionId={promotion.id} sessions={sessionViewModels} />
    </div>
  );
}
