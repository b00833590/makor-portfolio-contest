/**
 * Audit + rattrapage des données existantes après le lot de correctifs P1
 * (voir l'audit swarm). Rejouable. Dry-run par défaut ; `--commit` pour écrire.
 *
 *   npx tsx scripts/audit-p1-data.ts                       # aperçu (toutes bases)
 *   DATABASE_URL="<prod>" npx tsx scripts/audit-p1-data.ts --commit
 *
 * Fait, et RIEN d'autre :
 *  1. Positions clôturées manquantes — rejoue l'historique de transactions de
 *     chaque portefeuille (replayPositions, la même logique que le runtime) et
 *     compare aux lignes `Position` stockées. `--commit` réécrit les
 *     portefeuilles qui divergent (deleteMany + createMany), sans toucher aux
 *     transactions ni aux snapshots.
 *  2. Actifs non-EUR détenus — liste les actifs dont `currency != EUR` qui ont
 *     au moins une position. Signalé uniquement (délister / convertir est une
 *     décision humaine).
 *  3. Transactions DECREASE — liste les portefeuilles concernés : leur cash
 *     disponible et leur classement changent avec le correctif #3 ; un
 *     recalcul de snapshot (bouton admin « Recalculer ») est recommandé.
 *
 * NE TOUCHE PAS : users, promotions, transactions, prices, badges, snapshots,
 * HallOfFameEntry.
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { replayPositions } from "@/lib/trading/replay-positions";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const COMMIT = process.argv.includes("--commit");
const CONTEST_CURRENCY = "EUR";

function shape(p: { assetId: string; quantity: number; closedAt: Date | null }): string {
  return `${p.assetId}:${p.quantity === 0 ? "closed" : p.quantity.toFixed(6)}`;
}

async function main() {
  const ref = (process.env.DATABASE_URL ?? "").match(/postgres\.([a-z0-9]+)/)?.[1] ?? "(inconnue)";
  console.log(`BASE : ${ref}   (${COMMIT ? "COMMIT" : "dry-run"})\n`);

  const portfolios = await db.portfolio.findMany({
    include: { user: { select: { name: true } }, promotion: { select: { name: true } } },
  });

  // --- 1. Positions clôturées manquantes ---
  console.log("=== 1. Divergence positions stockées vs rejeu de l'historique ===");
  let divergent = 0;
  for (const pf of portfolios) {
    const [transactions, stored] = await Promise.all([
      db.transaction.findMany({ where: { portfolioId: pf.id }, orderBy: { createdAt: "asc" } }),
      db.position.findMany({ where: { portfolioId: pf.id } }),
    ]);

    const replayed = replayPositions(transactions);
    const storedShapes = stored
      .map((p) => shape({ assetId: p.assetId, quantity: Number(p.quantity), closedAt: p.closedAt }))
      .sort();
    const replayedShapes = replayed.map(shape).sort();
    const same = storedShapes.length === replayedShapes.length && storedShapes.every((s, i) => s === replayedShapes[i]);
    if (same) continue;

    divergent++;
    const storedClosed = stored.filter((p) => p.closedAt).length;
    const replayedClosed = replayed.filter((p) => p.closedAt).length;
    console.log(
      `  ${pf.user.name.padEnd(22)} [${pf.promotion.name}]  ` +
        `stockées ${stored.length} (dont ${storedClosed} clôturées) -> rejeu ${replayed.length} (dont ${replayedClosed})`,
    );

    if (COMMIT) {
      await db.$transaction(async (tx) => {
        await tx.position.deleteMany({ where: { portfolioId: pf.id } });
        if (replayed.length > 0) {
          await tx.position.createMany({
            data: replayed.map((p) => ({
              portfolioId: pf.id,
              assetId: p.assetId,
              quantity: p.quantity,
              avgEntryPrice: p.avgEntryPrice,
              openedAt: p.openedAt,
              closedAt: p.closedAt,
            })),
          });
        }
      });
      console.log("    ✓ réécrit");
    }
  }
  console.log(`  ${divergent}/${portfolios.length} portefeuille(s) divergent(s).\n`);

  // --- 2. Actifs non-EUR détenus ---
  console.log("=== 2. Actifs non-EUR avec au moins une position ===");
  const nonEurAssets = await db.asset.findMany({
    where: { NOT: { currency: CONTEST_CURRENCY }, positions: { some: {} } },
    include: {
      positions: {
        where: { closedAt: null, quantity: { gt: 0 } },
        include: { portfolio: { include: { user: { select: { name: true } }, promotion: { select: { name: true, status: true } } } } },
      },
    },
  });
  if (nonEurAssets.length === 0) {
    console.log("  aucun.\n");
  } else {
    for (const asset of nonEurAssets) {
      const holders = asset.positions
        .map((p) => `${p.portfolio.user.name} (${p.portfolio.promotion.name}/${p.portfolio.promotion.status})`)
        .join(", ");
      console.log(`  ${asset.symbol.padEnd(10)} ${asset.currency}  ${asset.name}`);
      console.log(`    positions ouvertes : ${holders || "(aucune ouverte, historique seulement)"}`);
    }
    console.log("  → décision manuelle : délister l'actif ou convertir les valorisations en EUR.\n");
  }

  // --- 3. Transactions DECREASE ---
  console.log("=== 3. Portefeuilles avec des transactions DECREASE (recalcul cash/classement) ===");
  const decreases = await db.transaction.groupBy({
    by: ["portfolioId"],
    where: { type: "DECREASE" },
    _count: { _all: true },
  });
  if (decreases.length === 0) {
    console.log("  aucun.\n");
  } else {
    for (const row of decreases) {
      const pf = portfolios.find((p) => p.id === row.portfolioId);
      console.log(`  ${(pf?.user.name ?? row.portfolioId).padEnd(22)} — ${row._count._all} DECREASE`);
    }
    console.log("  → relancer « Recalculer » sur ces portefeuilles depuis /admin/portfolios.\n");
  }

  if (!COMMIT) console.log("(dry-run — relancer avec --commit pour réécrire les positions divergentes)");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
