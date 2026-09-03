/**
 * Nettoyage rétroactif : retire d'une promotion les badges attribués AVANT la
 * fin de la fenêtre de constitution du portefeuille — sauf ceux qui portent
 * précisément sur cette phase (PREMIER_PAS, PORTEFEUILLE_COMPLET, LEVE_TOT,
 * HABITUE). Après la fermeture de la fenêtre, le cron / le prochain trade
 * ré-attribue ce qui est encore mérité.
 *
 *   npx tsx scripts/clean-premature-badges.ts "Promotion Septembre 2026"
 *   npx tsx scripts/clean-premature-badges.ts "Promotion Septembre 2026" --commit
 *
 * Garde-fou : refuse d'agir si la fenêtre de constitution est déjà terminée
 * (sinon on supprimerait des badges légitimement regagnés).
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { BADGE_CATALOG } from "@/lib/gamification/badges/catalog";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const COMMIT = process.argv.includes("--commit");
const promotionName = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

const EXEMPT = new Set(BADGE_CATALOG.filter((spec) => spec.awardableDuringInit).map((spec) => spec.code));

async function main() {
  if (!promotionName) {
    console.error('Usage : npx tsx scripts/clean-premature-badges.ts "<nom de la promotion>" [--commit]');
    process.exit(1);
  }
  console.log("Badges exemptés (conservés) :", [...EXEMPT].join(", "));

  const promotion = await db.promotion.findFirst({
    where: { name: promotionName },
    select: { id: true, name: true, status: true },
  });
  if (!promotion) throw new Error(`Promotion "${promotionName}" introuvable.`);

  const initSession = await db.changeSession.findFirst({
    where: { promotionId: promotion.id, kind: "INITIALIZATION" },
    select: { closesAt: true, status: true },
  });
  const now = new Date();
  const initClosed = !initSession || initSession.status === "CLOSED" || now > initSession.closesAt;
  console.log(`Fenêtre de constitution : ${initSession ? initSession.closesAt.toISOString() : "aucune"} → ${initClosed ? "TERMINÉE" : "ouverte"}`);
  if (initClosed) {
    console.error("\n⛔ La fenêtre est terminée — refus d'agir (des badges ont pu être regagnés légitimement).");
    process.exit(1);
  }

  const rows = await db.userBadge.findMany({
    where: { promotionId: promotion.id },
    select: { id: true, user: { select: { name: true } }, badge: { select: { code: true } } },
  });
  const toDelete = rows.filter((row) => !EXEMPT.has(row.badge.code));

  console.log(`\n${rows.length} badge(s) attribué(s) dans « ${promotion.name} », ${toDelete.length} prématuré(s) :`);
  const byUser = new Map<string, string[]>();
  for (const row of toDelete) {
    const list = byUser.get(row.user.name) ?? [];
    list.push(row.badge.code);
    byUser.set(row.user.name, list);
  }
  for (const [name, codes] of byUser) console.log(`  ${name} : ${codes.join(", ")}`);

  if (toDelete.length === 0) {
    console.log("\n✅ Rien à retirer.");
  } else if (COMMIT) {
    const result = await db.userBadge.deleteMany({ where: { id: { in: toDelete.map((row) => row.id) } } });
    console.log(`\n✅ ${result.count} badge(s) retiré(s). Ils seront ré-attribués après la fermeture de la fenêtre s'ils sont encore mérités.`);
  } else {
    console.log("\nDry-run — relancez avec --commit pour appliquer.");
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Échec :", e);
  process.exit(1);
});
