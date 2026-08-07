import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { formatParisDateTime } from "@/lib/timezone";
import { computeChangeSessionStatus } from "@/lib/trading/change-session-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RulesDocument } from "@/components/rules-document";
import { RulesEditForm } from "../rules-edit-form";

export default async function AdminPromotionReglementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const promotion = await db.promotion.findUnique({
    where: { id },
    include: { changeSessions: { orderBy: { opensAt: "asc" } } },
  });

  if (!promotion) {
    notFound();
  }

  const revisions = await db.auditLog.findMany({
    where: { target: id, action: "promotion.rules_update" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { admin: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/admin/promotions/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← {promotion.name}
        </Link>
        <h2 className="mt-1 text-lg font-semibold">Règlement</h2>
        <p className="text-sm text-muted-foreground">
          Généré automatiquement à partir des paramètres de la promotion. Le texte d&apos;introduction et les notes
          complémentaires ci-dessous sont librement modifiables.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modifier le contenu éditable</CardTitle>
        </CardHeader>
        <CardContent>
          <RulesEditForm
            promotionId={promotion.id}
            rulesIntro={promotion.rulesIntro ?? ""}
            rulesCustomNotes={promotion.rulesCustomNotes ?? ""}
          />
        </CardContent>
      </Card>

      {revisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des modifications</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {revisions.map((revision) => (
              <div key={revision.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                <span className="text-muted-foreground">{formatParisDateTime(revision.createdAt)}</span>
                <span className="font-medium text-foreground">{revision.admin.name}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Aperçu — vue exacte des participants
        </p>
        <RulesDocument
          promotion={{
            name: promotion.name,
            startDate: promotion.startDate,
            endDate: promotion.endDate,
            initialCapital: Number(promotion.initialCapital),
            rules: promotionRulesSchema.parse(promotion.rules),
            rulesIntro: promotion.rulesIntro,
            rulesCustomNotes: promotion.rulesCustomNotes,
          }}
          changeSessions={promotion.changeSessions.map((session) => ({
            ...session,
            effectiveStatus: computeChangeSessionStatus(session, new Date()),
          }))}
        />
      </div>
    </div>
  );
}
