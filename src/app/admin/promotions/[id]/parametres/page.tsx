import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { PromotionSettingsForm } from "./promotion-settings-form";

export default async function PromotionSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const promotion = await db.promotion.findUnique({ where: { id } });
  if (!promotion) {
    notFound();
  }

  const transactionCount = await db.transaction.count({ where: { portfolio: { promotionId: id } } });
  const rules = promotionRulesSchema.parse(promotion.rules);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/promotions/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← {promotion.name}
        </Link>
        <h2 className="mt-1 text-lg font-semibold">Paramètres de la promotion</h2>
        <p className="text-sm text-muted-foreground">
          Ces règles s&apos;appliquent immédiatement à tous les participants de cette promotion, dès leur prochain
          ordre — pas besoin de créer une nouvelle promotion pour ajuster le concours en cours.
        </p>
      </div>

      <PromotionSettingsForm
        promotionId={id}
        initialCapital={Number(promotion.initialCapital)}
        rules={rules}
        capitalLocked={transactionCount > 0}
      />
    </div>
  );
}
