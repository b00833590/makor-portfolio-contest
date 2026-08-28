import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { closeEndedPromotions } from "@/lib/promotion-lifecycle";
import { snapshotActivePromotions } from "@/lib/trading/snapshot-service";
import { evaluateAndAwardBadges } from "@/lib/gamification/evaluate-badges";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Voir le commentaire équivalent dans /api/cron/ingest-prices/route.ts :
    // ouvert en local par confort, mais refusé en production pour éviter
    // qu'un appelant anonyme ne pollue le classement/l'historique de perf.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET n'est pas configuré." }, { status: 503 });
    }
  } else {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Filet de sécurité : si aucun participant ne s'est connecté après la fin
  // d'un concours, la clôture n'a pas eu lieu au fil de l'eau — on la
  // rattrape ici avant le snapshot du soir. Idempotent.
  const autoClosed = await closeEndedPromotions();

  const snapshotResults = await snapshotActivePromotions();

  // Les badges dépendent des snapshots qui viennent d'être créés (rendement, rang) —
  // évalués juste après, dans le même job planifié plutôt qu'un cron dédié (limite
  // de 2 crons sur le plan Vercel Hobby déjà atteinte avec ingest-prices).
  const activePromotions = await db.promotion.findMany({
    where: { status: PromotionStatus.ACTIVE },
    select: { id: true },
  });
  const badgeResults = await Promise.all(
    activePromotions.map((promotion) => evaluateAndAwardBadges(promotion.id)),
  );

  return NextResponse.json({ autoClosed, snapshotResults, badgeResults: badgeResults.flat() });
}
