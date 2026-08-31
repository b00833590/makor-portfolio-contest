/**
 * Dry-run lecture seule : pour chaque participant de la promotion la plus récente,
 * liste les badges NON close-only que le nouveau catalogue attribuerait aujourd'hui.
 * Sert de garde-fou avant le lancement du concours suivant — repère un badge
 * « exploit » distribué à tort, ou un catalogue qui n'attribuerait jamais rien.
 *
 *   DATABASE_URL="<prod>" npx tsx scripts/badge-dryrun.ts
 *
 * N'écrit rien.
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { evaluateBadgeCatalog } from "@/lib/gamification/badges/catalog";
import { baseContext } from "@/lib/gamification/badges/badge-test-context";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const ref = (process.env.DATABASE_URL ?? "").match(/postgres\.([a-z0-9]+)/)?.[1] ?? "(inconnue)";
  console.log(`BASE : ${ref}   (dry-run, lecture seule)\n`);

  const promo = await db.promotion.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  const portfolios = await db.portfolio.findMany({
    where: { promotionId: promo.id },
    include: { user: { select: { name: true, currentStreakDays: true, longestStreakDays: true } } },
  });

  for (const pf of portfolios) {
    const [snapshots, transactions] = await Promise.all([
      db.performanceSnapshot.findMany({ where: { portfolioId: pf.id }, orderBy: { timestamp: "desc" } }),
      db.transaction.findMany({ where: { portfolioId: pf.id }, select: { assetId: true } }),
    ]);
    const latest = snapshots[0];

    // Contexte partiel : suffisant pour un contrôle « rien d'aberrant ». Les badges
    // qui dépendent de champs non renseignés ici resteront simplement non attribués.
    const ctx = baseContext({
      cumulativeReturnPct: latest ? Number(latest.cumulativeReturnPct) : 0,
      dailyReturnPct: latest ? Number(latest.dailyReturnPct) : null,
      currentRank: latest?.rank ?? null,
      transactionCount: transactions.length,
      distinctAssetsTradedCount: new Set(transactions.map((t) => t.assetId)).size,
      rankHistory: snapshots.map((s) => ({ timestamp: s.timestamp, rank: s.rank })),
      currentStreakDays: pf.user.currentStreakDays,
      longestStreakDays: pf.user.longestStreakDays,
      participantCount: portfolios.length,
    });

    const earned = evaluateBadgeCatalog(ctx);
    console.log(`  ${pf.user.name.padEnd(24)} → ${earned.length ? earned.join(", ") : "(aucun)"}`);
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
