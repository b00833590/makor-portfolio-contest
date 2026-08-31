/**
 * Recalcule le résultat officiel figé d'un concours DÉJÀ clôturé, en valorisant
 * chaque position au dernier cours connu <= endDate (aucun prix postérieur à la
 * fin officielle). Met à jour les HallOfFameEntry existantes (finalReturnPct,
 * finalPnlEur, finalRank) + écrit un PerformanceSnapshot terminal par
 * portefeuille à timestamp = endDate.
 *
 * NE TOUCHE PAS : users, portfolios, positions, transactions, prices, avatars,
 * closedAt, userName. Idempotent.
 *
 * Dry-run par défaut. Ajouter `--commit` pour écrire réellement.
 *
 *   npx tsx scripts/recompute-closed-promotion.ts            # aperçu
 *   npx tsx scripts/recompute-closed-promotion.ts --commit   # applique
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { rankEntries } from "@/lib/gamification/ranking";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const COMMIT = process.argv.includes("--commit");

async function computeAvailableCash(portfolioId: string, initialCapital: number): Promise<number> {
  const txs = await db.transaction.findMany({ where: { portfolioId }, select: { type: true, amount: true } });
  return txs.reduce((cash, t) => {
    const amount = Number(t.amount);
    const inflow = t.type === "SELL_FULL" || t.type === "SELL_PARTIAL";
    return inflow ? cash + amount : cash - amount;
  }, initialCapital);
}

async function main() {
  const promo = await db.promotion.findFirstOrThrow({ where: { status: "CLOSED" }, orderBy: { createdAt: "desc" } });
  const asOf = promo.endDate;
  const initialCapital = Number(promo.initialCapital);
  console.log(`Promotion "${promo.name}" — gel au ${asOf.toISOString()}\n`);

  const portfolios = await db.portfolio.findMany({
    where: { promotionId: promo.id },
    include: { user: { select: { id: true, name: true } } },
  });

  // 1 requête groupée : dernier prix <= asOf par actif.
  const allPositions = await db.position.findMany({
    where: { portfolioId: { in: portfolios.map((p) => p.id) }, quantity: { gt: 0 }, closedAt: null },
  });
  const assetIds = [...new Set(allPositions.map((p) => p.assetId))];
  const priceRows = await db.price.findMany({
    where: { assetId: { in: assetIds }, timestamp: { lte: asOf } },
    orderBy: { timestamp: "desc" },
    distinct: ["assetId"],
  });
  const priceByAsset = new Map(priceRows.map((r) => [r.assetId, Number(r.price)]));

  const entries = await Promise.all(
    portfolios.map(async (pf) => {
      const cash = await computeAvailableCash(pf.id, initialCapital);
      const positions = allPositions.filter((p) => p.portfolioId === pf.id);
      const marketValue = positions.reduce((sum, pos) => {
        const price = priceByAsset.get(pos.assetId) ?? Number(pos.avgEntryPrice);
        if (!priceByAsset.has(pos.assetId)) console.log(`  ⚠️ pas de prix <= endDate pour ${pos.assetId} — avgEntryPrice`);
        return sum + Number(pos.quantity) * price;
      }, 0);
      const totalValue = cash + marketValue;
      const cumulativeReturnPct = initialCapital > 0 ? ((totalValue - initialCapital) / initialCapital) * 100 : 0;
      return { portfolioId: pf.id, userId: pf.user.id, name: pf.user.name, totalValue, cumulativeReturnPct };
    }),
  );

  const ranked = rankEntries(entries);
  const hof = await db.hallOfFameEntry.findMany({ where: { promotionId: promo.id } });

  console.log("\n=== Avant → Après ===");
  for (const row of ranked.sort((a, b) => a.rank - b.rank)) {
    const existing = hof.find((h) => h.userId === row.userId);
    const newPnl = row.totalValue - initialCapital;
    console.log(
      `  #${row.rank} ${row.name.padEnd(24)} ` +
        `rendement ${existing ? Number(existing.finalReturnPct).toFixed(4) : "?"}% → ${row.cumulativeReturnPct.toFixed(4)}%  |  ` +
        `P&L ${existing ? Number(existing.finalPnlEur).toFixed(2) : "?"} → ${newPnl.toFixed(2)}  |  ` +
        `rang ${existing?.finalRank ?? "?"} → ${row.rank}`,
    );
  }

  if (!COMMIT) {
    console.log("\n(dry-run — relancer avec --commit pour appliquer)");
    await db.$disconnect();
    return;
  }

  console.log("\nApplication…");
  for (const row of ranked) {
    const existing = hof.find((h) => h.userId === row.userId);
    if (!existing) {
      console.log(`  ⚠️ aucune HallOfFameEntry pour ${row.name} — ignorée`);
      continue;
    }
    await db.hallOfFameEntry.update({
      where: { id: existing.id },
      data: {
        finalReturnPct: row.cumulativeReturnPct,
        finalPnlEur: row.totalValue - initialCapital,
        finalRank: row.rank,
      },
    });

    const existingSnap = await db.performanceSnapshot.findFirst({
      where: { portfolioId: row.portfolioId, timestamp: asOf },
    });
    if (existingSnap) {
      await db.performanceSnapshot.update({
        where: { id: existingSnap.id },
        data: { totalValue: row.totalValue, cumulativeReturnPct: row.cumulativeReturnPct, rank: row.rank, dailyReturnPct: 0 },
      });
    } else {
      await db.performanceSnapshot.create({
        data: {
          portfolioId: row.portfolioId,
          timestamp: asOf,
          totalValue: row.totalValue,
          dailyReturnPct: 0,
          cumulativeReturnPct: row.cumulativeReturnPct,
          rank: row.rank,
        },
      });
    }
    console.log(`  ✓ ${row.name}`);
  }
  console.log("\nTerminé.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
