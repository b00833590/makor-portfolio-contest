/**
 * Exception manuelle, ponctuelle, pour UNE seule position : la position LULU
 * de Salomé Michela. Ne touche à rien d'autre — ni la logique générale de
 * tarification, ni aucun autre participant.
 *
 * Contexte (décision admin du 2026-09-04) : Salomé a acheté LULU pendant la
 * fenêtre d'initialisation, avant l'ouverture US, au dernier cours de clôture
 * connu (121,77 $, clôture du 03/09 — comportement normal du pull-through
 * hors séance). LULU a ensuite chuté d'environ -17 % à l'ouverture US du
 * 04/09 suite à une annonce. L'admin décide, à titre exceptionnel et pour ce
 * cas précis uniquement, de retenir comme prix de référence le cours
 * d'ouverture officiel du 04/09 (98,20 $ — vérifié auprès de Yahoo Finance :
 * barre d'ouverture Nasdaq 13:30:00 UTC, volume réel 5 139 748 titres,
 * concordant avec le champ "open" du OHLC quotidien officiel) plutôt que la
 * clôture du 03/09.
 *
 * Le montant investi (50 000 €, Transaction.amount) reste inchangé — c'est ce
 * qui a réellement été débité de son capital disponible. Seuls le prix de
 * référence et, en conséquence, la quantité de titres qu'il permet d'acheter
 * sont recalculés : quantity = amount / referencePrice. Position ET
 * transaction d'achat sont mises à jour ensemble pour rester cohérentes avec
 * un futur recalcul admin (recalculateSnapshot / recompute-portfolio, qui
 * rejoue les positions depuis les transactions).
 *
 * openedAt n'est PAS modifié : c'est l'horodatage réel de l'exécution de
 * l'ordre dans l'application, pas le prix de référence — aucune raison de le
 * changer.
 *
 *   npx tsx scripts/fix-salome-lulu-reference-price.ts            # diagnostic seul
 *   npx tsx scripts/fix-salome-lulu-reference-price.ts --commit   # applique
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const COMMIT = process.argv.includes("--commit");

const USER_NAME = "Salomé Michela";
const SYMBOL = "LULU";
/** Cours d'ouverture officiel Nasdaq vérifié pour le 2026-09-04 (voir contexte ci-dessus). */
const REFERENCE_PRICE = 98.2;

async function main() {
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
  console.log("positions LULU ouvertes :", positions.length);
  console.log("transactions LULU :", txns.map((t) => `${t.type} amount=${Number(t.amount)} price=${Number(t.price)} qty=${Number(t.quantity)}`));

  if (positions.length !== 1) throw new Error(`Attendu 1 position LULU ouverte, trouvé ${positions.length}. Abandon.`);
  const buys = txns.filter((t) => t.type === "BUY");
  if (txns.length !== 1 || buys.length !== 1) {
    throw new Error(`Attendu exactement 1 transaction LULU (BUY), trouvé ${txns.length}. Abandon (cas non prévu).`);
  }
  const position = positions[0];
  const buy = buys[0];
  const investedAmount = Number(buy.amount); // ce qu'elle a réellement dépensé — reste inchangé

  const newQuantity = investedAmount / REFERENCE_PRICE;

  console.log("\n=== EXCEPTION APPLIQUÉE (cette position uniquement) ===");
  console.log(`prix de référence : ${Number(position.avgEntryPrice)}  ->  ${REFERENCE_PRICE} (ouverture US du 04/09, vérifiée)`);
  console.log(`montant investi conservé : ${investedAmount} €`);
  console.log(`quantity : ${Number(position.quantity)}  ->  ${newQuantity}`);
  console.log(`ancienne perte latente : ${(((Number(position.avgEntryPrice) - REFERENCE_PRICE) / Number(position.avgEntryPrice)) * -100).toFixed(2)}% (référence précédente)`);

  if (!COMMIT) {
    console.log("\nRelancez avec --commit pour appliquer.");
    await db.$disconnect();
    return;
  }

  await db.$transaction([
    db.position.update({ where: { id: position.id }, data: { avgEntryPrice: REFERENCE_PRICE, quantity: newQuantity } }),
    db.transaction.update({ where: { id: buy.id }, data: { price: REFERENCE_PRICE, quantity: newQuantity } }),
  ]);
  console.log("\n✅ Position et transaction LULU de Salomé recalées sur le prix d'ouverture du 04/09.");
  await db.$disconnect();
}

main().catch((error) => {
  console.error("Échec :", error);
  process.exit(1);
});
