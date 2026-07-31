import Link from "next/link";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PromotionForm } from "./promotion-form";
import { setPromotionStatus } from "./actions";

const statusLabels: Record<PromotionStatus, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "En cours",
  CLOSED: "Terminée",
};

const nextStatus: Partial<Record<PromotionStatus, PromotionStatus>> = {
  DRAFT: PromotionStatus.ACTIVE,
  ACTIVE: PromotionStatus.CLOSED,
};

const nextStatusLabel: Partial<Record<PromotionStatus, string>> = {
  DRAFT: "Ouvrir la promotion",
  ACTIVE: "Clôturer la promotion",
};

export default async function PromotionsPage() {
  const promotions = await db.promotion.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, portfolios: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle promotion</CardTitle>
        </CardHeader>
        <CardContent>
          <PromotionForm />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {promotions.length === 0 && (
          <p className="text-sm text-zinc-500">Aucune promotion pour le moment.</p>
        )}
        {promotions.map((promotion) => {
          const upcoming = nextStatus[promotion.status];
          return (
            <Card key={promotion.id}>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <Link href={`/admin/promotions/${promotion.id}`} className="hover:underline">
                    <CardTitle>{promotion.name}</CardTitle>
                  </Link>
                  <p className="mt-1 text-sm text-zinc-500">
                    {promotion.startDate.toLocaleDateString("fr-FR")} →{" "}
                    {promotion.endDate.toLocaleDateString("fr-FR")} ·{" "}
                    {promotion._count.users} participant(s)
                  </p>
                </div>
                <Badge variant={promotion.status === "ACTIVE" ? "default" : "secondary"}>
                  {statusLabels[promotion.status]}
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button variant="ghost" render={<Link href={`/admin/promotions/${promotion.id}`} />}>
                  Sessions de changement
                </Button>
                {upcoming && (
                  <form action={setPromotionStatus.bind(null, promotion.id, upcoming)}>
                    <Button type="submit" variant="outline">
                      {nextStatusLabel[promotion.status]}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
