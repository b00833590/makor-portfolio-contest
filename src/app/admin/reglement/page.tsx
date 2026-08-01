import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * L'admin peut gérer plusieurs promotions — cette page ne fait qu'orienter
 * vers le règlement de la bonne promotion (redirection directe s'il n'y en a
 * qu'une, sélecteur sinon). Le règlement lui-même vit sous
 * /admin/promotions/[id]/reglement, à côté des autres pages de gestion.
 */
export default async function AdminReglementPage() {
  await requireAdmin();

  const promotions = await db.promotion.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, startDate: true, endDate: true },
  });

  if (promotions.length === 1) {
    redirect(`/admin/promotions/${promotions[0].id}/reglement`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Règlement</h2>
        <p className="text-sm text-muted-foreground">Choisissez une promotion pour consulter ou modifier son règlement.</p>
      </div>

      {promotions.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune promotion créée pour le moment.</p>
      )}

      <div className="flex flex-col gap-3">
        {promotions.map((promotion) => (
          <Link key={promotion.id} href={`/admin/promotions/${promotion.id}/reglement`}>
            <Card className="transition-colors hover:bg-secondary/40">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{promotion.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {promotion.startDate.toLocaleDateString("fr-FR")} → {promotion.endDate.toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Badge variant={promotion.status === "ACTIVE" ? "default" : "secondary"}>{promotion.status}</Badge>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
