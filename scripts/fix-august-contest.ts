/**
 * Correction unique du concours « Promotion Août 2026 » sur la base de PRODUCTION
 * (omhyxzfygpiyqobtqltq). Rejouable. Dry-run par défaut ; `--commit` pour écrire.
 *
 *   npx tsx scripts/fix-august-contest.ts            # aperçu
 *   npx tsx scripts/fix-august-contest.ts --commit   # applique
 *
 * Fait, et RIEN d'autre :
 *  1. Corrige startDate / endDate du concours (minuit UTC -> heures de Paris réelles).
 *  2. Recalcule les 3 HallOfFameEntry au dernier cours <= endDate corrigée
 *     (finalReturnPct, finalPnlEur, finalRank) + closedAt = endDate corrigée.
 *  3. Recopie la photo de profil de chaque participant dans son HallOfFameEntry.
 *  4. Écrit un PerformanceSnapshot terminal par portefeuille à timestamp = endDate.
 *
 * NE TOUCHE PAS : users, portfolios, positions, transactions, prices, badges.
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { rankEntries } from "@/lib/gamification/ranking";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const COMMIT = process.argv.includes("--commit");

// Valeurs attendues AVANT correction (garde-fou : on refuse d'agir si la base
// ne ressemble pas à ce qu'on croit).
const EXPECTED_OLD_START = "2026-08-06T00:00:00.000Z";
const EXPECTED_OLD_END = "2026-08-28T00:00:00.000Z";
const NEW_START = new Date("2026-08-06T13:00:00.000Z"); // 15h00 Europe/Paris
const NEW_END = new Date("2026-08-28T11:00:00.000Z"); // 13h00 Europe/Paris

async function computeAvailableCash(portfolioId: string, initialCapital: number): Promise<number> {
  const txs = await db.transaction.findMany({ where: { portfolioId }, select: { type: true, amount: true } });
  return txs.reduce((cash, t) => {
    const inflow = t.type === "SELL_FULL" || t.type === "SELL_PARTIAL";
    return inflow ? cash + Number(t.amount) : cash - Number(t.amount);
  }, initialCapital);
}

function pct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(4)}%`;
}

async function main() {
  const ref = (process.env.DATABASE_URL ?? "").match(/postgres\.([a-z0-9]+)/)?.[1];
  console.log(`BASE : ${ref}   (${COMMIT ? "COMMIT" : "dry-run"})\n`);
  if (ref !== "omhyxzfygpiyqobtqltq") {
    throw new Error(`Base inattendue (${ref}). Ce script vise omhyxzfygpiyqobtqltq. Abandon.`);
  }

  const promo = await db.promotion.findFirstOrThrow({ where: { status: "CLOSED" }, orderBy: { createdAt: "desc" } });
  const initialCapital = Number(promo.initialCapital);

  // --- 1. Dates ---
  console.log("=== 1. Dates du concours ===");
  console.log(`  startDate : ${promo.startDate.toISOString()}  ->  ${NEW_START.toISOString()}`);
  console.log(`  endDate   : ${promo.endDate.toISOString()}  ->  ${NEW_END.toISOString()}`);
  const datesAlreadyFixed =
    promo.startDate.toISOString() === NEW_START.toISOString() && promo.endDate.toISOString() === NEW_END.toISOString();
  if (!datesAlreadyFixed) {
    if (promo.startDate.toISOString() !== EXPECTED_OLD_START || promo.endDate.toISOString() !== EXPECTED_OLD_END) {
      throw new Error(
        `Dates actuelles inattendues (${promo.startDate.toISOString()} / ${promo.endDate.toISOString()}). ` +
          `Attendu ${EXPECTED_OLD_START} / ${EXPECTED_OLD_END}. Abandon — vérifier manuellement.`,
      );
    }
  } else {
    console.log("  (déjà corrigées)");
  }

  // --- 2+3. Recalcul figé au dernier cours <= NEW_END ---
  const portfolios = await db.portfolio.findMany({
    where: { promotionId: promo.id },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  const allPositions = await db.position.findMany({
    where: { portfolioId: { in: portfolios.map((p) => p.id) }, quantity: { gt: 0 }, closedAt: null },
  });
  const assetIds = [...new Set(allPositions.map((p) => p.assetId))];
  const priceRows = await db.price.findMany({
    where: { assetId: { in: assetIds }, timestamp: { lte: NEW_END } },
    orderBy: { timestamp: "desc" },
    distinct: ["assetId"],
  });
  const priceByAsset = new Map(priceRows.map((r) => [r.assetId, Number(r.price)]));
  const missing = assetIds.filter((id) => !priceByAsset.has(id));
  if (missing.length) console.log(`\n  ⚠️ ${missing.length} actif(s) sans prix <= endDate — valorisés au prix d'entrée`);

  const entries = await Promise.all(
    portfolios.map(async (pf) => {
      const cash = await computeAvailableCash(pf.id, initialCapital);
      const marketValue = allPositions
        .filter((p) => p.portfolioId === pf.id)
        .reduce((sum, pos) => sum + Number(pos.quantity) * (priceByAsset.get(pos.assetId) ?? Number(pos.avgEntryPrice)), 0);
      const totalValue = cash + marketValue;
      return {
        portfolioId: pf.id,
        userId: pf.user.id,
        name: pf.user.name,
        avatarUrl: pf.user.avatarUrl,
        totalValue,
        cumulativeReturnPct: initialCapital > 0 ? ((totalValue - initialCapital) / initialCapital) * 100 : 0,
      };
    }),
  );
  const ranked = rankEntries(entries).sort((a, b) => a.rank - b.rank);
  const hof = await db.hallOfFameEntry.findMany({ where: { promotionId: promo.id } });

  console.log("\n=== 2+3. HallOfFameEntry : avant -> après ===");
  for (const row of ranked) {
    const existing = hof.find((h) => h.userId === row.userId);
    const newPnl = row.totalValue - initialCapital;
    console.log(
      `  #${row.rank} ${row.name.padEnd(22)} ` +
        `${existing ? pct(Number(existing.finalReturnPct)) : "?"} -> ${pct(row.cumulativeReturnPct)}  |  ` +
        `P&L ${existing ? Number(existing.finalPnlEur).toFixed(0) : "?"} -> ${newPnl.toFixed(0)}  |  ` +
        `rang ${existing?.finalRank ?? "?"} -> ${row.rank}  |  ` +
        `photo ${existing?.avatarUrl ? "ok" : "NULL"} -> ${row.avatarUrl ? "ok" : "NULL"}`,
    );
  }

  // --- 4. PerformanceSnapshot terminal ---
  const existingSnaps = await db.performanceSnapshot.findMany({
    where: { portfolioId: { in: ranked.map((r) => r.portfolioId) }, timestamp: NEW_END },
    select: { portfolioId: true },
  });
  console.log(
    `\n=== 4. PerformanceSnapshot @ ${NEW_END.toISOString()} : ${existingSnaps.length}/${ranked.length} déjà présents ===`,
  );

  if (!COMMIT) {
    console.log("\n(dry-run — relancer avec --commit pour appliquer)");
    await db.$disconnect();
    return;
  }

  console.log("\n--- Application ---");
  if (!datesAlreadyFixed) {
    await db.promotion.update({ where: { id: promo.id }, data: { startDate: NEW_START, endDate: NEW_END } });
    console.log("  ✓ dates corrigées");
  }

  const snapDone = new Set(existingSnaps.map((s) => s.portfolioId));
  for (const row of ranked) {
    const existing = hof.find((h) => h.userId === row.userId);
    if (existing) {
      await db.hallOfFameEntry.update({
        where: { id: existing.id },
        data: {
          finalReturnPct: row.cumulativeReturnPct,
          finalPnlEur: row.totalValue - initialCapital,
          finalRank: row.rank,
          avatarUrl: row.avatarUrl,
          closedAt: NEW_END,
        },
      });
      console.log(`  ✓ HoF ${row.name}`);
    } else {
      console.log(`  ⚠️ pas de HallOfFameEntry pour ${row.name} — ignoré`);
    }

    if (!snapDone.has(row.portfolioId)) {
      await db.performanceSnapshot.create({
        data: {
          portfolioId: row.portfolioId,
          timestamp: NEW_END,
          totalValue: row.totalValue,
          dailyReturnPct: 0,
          cumulativeReturnPct: row.cumulativeReturnPct,
          rank: row.rank,
        },
      });
      console.log(`  ✓ snapshot ${row.name}`);
    }
  }
  console.log("\nTerminé.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
