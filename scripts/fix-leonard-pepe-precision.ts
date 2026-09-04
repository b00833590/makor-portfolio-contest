/**
 * Re-synchronise la position PEPE de Léonard après l'élargissement de précision
 * (migration 20260904130000_widen_price_precision).
 *
 * Contexte : PEPE a été acheté quand `Price.price` / `Position.avgEntryPrice`
 * étaient en Decimal(18, 6). Le cours réel (~0,00000306 €) a été tronqué à
 * 0,000003, donc la quantité (25 000 € / 0,000003) est ~2 % trop élevée et la
 * valeur de la position saute de ±33 % à chaque changement de quantum tant que
 * le prix stocké reste grossier.
 *
 * Ce script, APRÈS la migration :
 *  1. récupère le cours précis PEPE/EUR chez Binance,
 *  2. recale la position ET la transaction d'achat sur ce cours
 *     (avgEntryPrice = cours précis, quantity = 25 000 / cours précis),
 *     de sorte que la valeur d'entrée reste 25 000 € et que la position soit
 *     stable ensuite.
 *
 * NE TOUCHE À RIEN D'AUTRE (aucune autre position, transaction, prix, badge).
 *
 *   npx tsx scripts/fix-leonard-pepe-precision.ts            # diagnostic seul
 *   npx tsx scripts/fix-leonard-pepe-precision.ts --commit   # applique
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const COMMIT = process.argv.includes("--commit");

const USER_NAME = "Léonard Bernet";
const SYMBOL = "PEPE";

async function fetchPrecisePepeEur(): Promise<number> {
  const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=PEPEEUR");
  if (!res.ok) throw new Error(`Binance PEPEEUR HTTP ${res.status}`);
  const body = (await res.json()) as { price?: string };
  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Binance PEPEEUR: prix invalide ${body.price}`);
  return price;
}

async function assertMigrationApplied(): Promise<void> {
  const rows = await db.$queryRaw<{ numeric_scale: number }[]>`
    SELECT numeric_scale FROM information_schema.columns
    WHERE table_name = 'Position' AND column_name = 'avgEntryPrice'
  `;
  const scale = rows[0]?.numeric_scale ?? 0;
  if (scale < 12) {
    throw new Error(
      `Position.avgEntryPrice a une échelle de ${scale} décimales — la migration ` +
        `20260904130000_widen_price_precision n'est pas appliquée. Lancez d'abord ` +
        `\`prisma migrate deploy\`, puis ce script.`,
    );
  }
}

async function main() {
  await assertMigrationApplied();

  const user = await db.user.findFirstOrThrow({ where: { name: USER_NAME }, select: { id: true, promotionId: true } });
  const asset = await db.asset.findFirstOrThrow({ where: { symbol: SYMBOL }, select: { id: true } });

  const portfolio = await db.portfolio.findFirstOrThrow({
    where: { userId: user.id, promotionId: user.promotionId ?? undefined },
    select: { id: true, promotion: { select: { name: true } } },
  });

  const positions = await db.position.findMany({
    where: { portfolioId: portfolio.id, assetId: asset.id, quantity: { gt: 0 }, closedAt: null },
  });
  const txns = await db.transaction.findMany({
    where: { portfolioId: portfolio.id, assetId: asset.id },
    orderBy: { createdAt: "asc" },
  });

  console.log("=== ÉTAT ACTUEL ===");
  console.log("portefeuille :", portfolio.id, `(${portfolio.promotion.name})`);
  console.log("positions PEPE ouvertes :", positions.length);
  console.log("transactions PEPE :", txns.map((t) => `${t.type} amount=${Number(t.amount)} price=${Number(t.price)} qty=${Number(t.quantity)}`));

  if (positions.length !== 1) throw new Error(`Attendu 1 position PEPE ouverte, trouvé ${positions.length}. Abandon.`);
  const buys = txns.filter((t) => t.type === "BUY");
  if (txns.length !== 1 || buys.length !== 1) {
    throw new Error(`Attendu exactement 1 transaction PEPE (BUY), trouvé ${txns.length}. Abandon (cas non prévu).`);
  }
  const position = positions[0];
  const buy = buys[0];
  const entryValue = Number(buy.amount); // ce qu'il a réellement dépensé

  const precisePrice = await fetchPrecisePepeEur();
  const newQuantity = entryValue / precisePrice;

  console.log("\n=== RECALAGE ===");
  console.log("cours précis PEPE/EUR (Binance) :", precisePrice);
  console.log(`valeur d'entrée conservée       : ${entryValue} €`);
  console.log(`avgEntryPrice : ${Number(position.avgEntryPrice)}  ->  ${precisePrice}`);
  console.log(`quantity      : ${Number(position.quantity)}  ->  ${newQuantity}`);
  console.log(`transaction   : price ${Number(buy.price)} -> ${precisePrice} ; qty ${Number(buy.quantity)} -> ${newQuantity} ; amount inchangé (${entryValue})`);

  if (!COMMIT) {
    console.log("\nRelancez avec --commit pour appliquer.");
    await db.$disconnect();
    return;
  }

  await db.$transaction([
    db.position.update({ where: { id: position.id }, data: { avgEntryPrice: precisePrice, quantity: newQuantity } }),
    db.transaction.update({ where: { id: buy.id }, data: { price: precisePrice, quantity: newQuantity } }),
  ]);
  console.log("\n✅ Position et transaction PEPE recalées.");
  await db.$disconnect();
}

main().catch((error) => {
  console.error("Échec :", error);
  process.exit(1);
});
