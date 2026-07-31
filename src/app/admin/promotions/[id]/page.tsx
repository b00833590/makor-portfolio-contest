import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ChangeSessionStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { ChangeSessionForm } from "./change-session-form";
import { setChangeSessionStatus } from "./actions";

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
    },
  });

  if (!promotion) {
    notFound();
  }

  const rules = promotionRulesSchema.parse(promotion.rules);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/promotions" className="text-sm text-zinc-500 hover:underline">
          ← Promotions
        </Link>
        <h2 className="mt-1 text-lg font-semibold">{promotion.name}</h2>
        <p className="text-sm text-zinc-500">
          {promotion.startDate.toLocaleDateString("fr-FR")} → {promotion.endDate.toLocaleDateString("fr-FR")}
        </p>
      </div>

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
          <p className="text-sm text-zinc-500">Aucune session de changement pour le moment.</p>
        )}
        {promotion.changeSessions.map((changeSession) => (
          <Card key={changeSession.id}>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Semaine {changeSession.weekNumber}</CardTitle>
                <p className="mt-1 text-sm text-zinc-500">
                  {changeSession.opensAt.toLocaleString("fr-FR")} →{" "}
                  {changeSession.closesAt.toLocaleString("fr-FR")} · {changeSession.maxChangesPerParticipant}{" "}
                  changements max
                </p>
              </div>
              <Badge variant={changeSession.status === "OPEN" ? "default" : "secondary"}>
                {statusLabels[changeSession.status]}
              </Badge>
            </CardHeader>
            <CardContent className="flex gap-2">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
