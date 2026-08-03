import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { SiteHeader } from "@/components/site-header";
import { RulesDocument } from "@/components/rules-document";

export default async function ReglementPage() {
  const session = await verifySession();

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { promotionId: true },
  });

  const promotion = user.promotionId
    ? await db.promotion.findUnique({
        where: { id: user.promotionId },
        include: { changeSessions: { orderBy: { weekNumber: "asc" } } },
      })
    : null;

  return (
    <>
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        {promotion ? (
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
            changeSessions={promotion.changeSessions}
          />
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Règlement</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Vous n&apos;êtes pas encore assigné à une promotion — le règlement s&apos;affichera ici dès que
              l&apos;administrateur vous aura rattaché à un concours.
            </p>
          </>
        )}
      </div>
    </>
  );
}
