/**
 * Diagnostic + correction ponctuelle : Léonard Bernet n'apparaît pas dans
 * « Promotion Septembre 2026 » alors qu'il y est inscrit (ligne
 * PromotionParticipant présente mais User.promotionId désynchronisé, et/ou
 * portefeuille manquant). Cause : bug du chemin "already-registered" qui ne
 * resynchronisait pas le pointeur ni ne re-provisionnait le portefeuille.
 *
 *   npx tsx scripts/fix-leonard-sept.ts            # diagnostic seul
 *   npx tsx scripts/fix-leonard-sept.ts --commit   # applique la correction
 *
 * Applique, et RIEN d'autre :
 *  1. User.promotionId = id de « Promotion Septembre 2026 » (si une ligne
 *     PromotionParticipant existe déjà pour ce couple).
 *  2. Crée le Portfolio manquant si la promotion est ACTIVE.
 * NE TOUCHE PAS : positions, transactions, prix, badges, autres users.
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const COMMIT = process.argv.includes("--commit");

const USER_NAME = "Léonard Bernet";
const PROMO_NAME = "Promotion Septembre 2026";

async function main() {
  const [user, promo] = await Promise.all([
    db.user.findFirst({
      where: { name: USER_NAME },
      select: {
        id: true,
        name: true,
        role: true,
        promotionId: true,
        promotion: { select: { name: true } },
        promotionParticipations: { select: { promotionId: true, promotion: { select: { name: true } } } },
        portfolios: { select: { id: true, promotionId: true } },
      },
    }),
    db.promotion.findFirst({ where: { name: PROMO_NAME }, select: { id: true, name: true, status: true } }),
  ]);

  if (!user) throw new Error(`Utilisateur "${USER_NAME}" introuvable.`);
  if (!promo) throw new Error(`Promotion "${PROMO_NAME}" introuvable.`);

  console.log("=== ÉTAT ACTUEL ===");
  console.log("User:", { id: user.id, role: user.role, promotionId: user.promotionId, promotionActive: user.promotion?.name ?? null });
  console.log("Inscriptions (PromotionParticipant):", user.promotionParticipations.map((p) => p.promotion.name));
  console.log("Portefeuilles:", user.portfolios);
  console.log("Promotion cible:", promo);

  const hasLedgerRow = user.promotionParticipations.some((p) => p.promotionId === promo.id);
  const hasPortfolio = user.portfolios.some((p) => p.promotionId === promo.id);
  const pointerOk = user.promotionId === promo.id;

  console.log("\n=== DIAGNOSTIC ===");
  console.log("Ligne d'inscription présente :", hasLedgerRow);
  console.log("Pointeur User.promotionId correct :", pointerOk);
  console.log("Portefeuille présent :", hasPortfolio);

  if (!hasLedgerRow) {
    console.log("\n⚠️  Aucune ligne d'inscription pour ce couple. Ré-inscrivez Léonard via l'admin (le bug corrigé synchronisera alors tout). Ce script ne crée pas de ligne d'inscription.");
    await db.$disconnect();
    return;
  }

  const actions: string[] = [];
  if (!pointerOk) actions.push(`User.promotionId : ${user.promotionId ?? "null"} -> ${promo.id}`);
  if (!hasPortfolio && promo.status === "ACTIVE") actions.push(`Créer Portfolio { userId: ${user.id}, promotionId: ${promo.id} }`);
  if (!hasPortfolio && promo.status !== "ACTIVE") console.log(`\n(Portefeuille non créé : promotion ${promo.status}, il le sera à l'activation.)`);

  if (actions.length === 0) {
    console.log("\n✅ Rien à corriger.");
    await db.$disconnect();
    return;
  }

  console.log("\n=== ACTIONS " + (COMMIT ? "(APPLIQUÉES)" : "(DRY-RUN)") + " ===");
  actions.forEach((a) => console.log(" - " + a));

  if (COMMIT) {
    if (!pointerOk) {
      await db.user.update({ where: { id: user.id }, data: { promotionId: promo.id } });
    }
    if (!hasPortfolio && promo.status === "ACTIVE") {
      await db.portfolio.createMany({ data: [{ userId: user.id, promotionId: promo.id }], skipDuplicates: true });
    }
    console.log("\n✅ Correction appliquée.");
  } else {
    console.log("\nRelancez avec --commit pour appliquer.");
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error("Échec :", error);
  process.exit(1);
});
