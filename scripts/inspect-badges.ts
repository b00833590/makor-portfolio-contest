/**
 * Lecture seule : état des badges de participants nommés, ventilé par promotion.
 *   npx tsx scripts/inspect-badges.ts "Adam Rouas" "Léonard Bernet"
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const names = process.argv.slice(2);

async function main() {
  const [promos, badgeCount] = await Promise.all([
    db.promotion.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, status: true } }),
    db.badge.count(),
  ]);
  const promoName = new Map(promos.map((p) => [p.id, `${p.name} (${p.status})`]));
  console.log("Promotions :", promos.map((p) => promoName.get(p.id)).join(" | "));
  console.log("Badges au catalogue :", badgeCount);
  console.log("Total UserBadge en base :", await db.userBadge.count());

  for (const name of names.length ? names : ["Adam Rouas", "Léonard Bernet"]) {
    const user = await db.user.findFirst({
      where: { name },
      select: {
        id: true,
        name: true,
        promotionId: true,
        promotionParticipations: { select: { promotionId: true } },
        portfolios: { select: { promotionId: true } },
        badges: {
          select: { badgeId: true, promotionId: true, awardedAt: true, badge: { select: { code: true, name: true } } },
          orderBy: { awardedAt: "asc" },
        },
      },
    });
    console.log("\n========================================");
    if (!user) {
      console.log(`"${name}" : introuvable`);
      continue;
    }
    console.log(`${user.name}  (id ${user.id})`);
    console.log(`  promotionId actif : ${user.promotionId ? promoName.get(user.promotionId) : "null"}`);
    console.log(`  inscriptions      : ${user.promotionParticipations.map((p) => promoName.get(p.promotionId)).join(", ") || "aucune"}`);
    console.log(`  portefeuilles     : ${user.portfolios.map((p) => promoName.get(p.promotionId)).join(", ") || "aucun"}`);
    console.log(`  UserBadge (${user.badges.length}) :`);
    const byPromo = new Map<string, string[]>();
    for (const b of user.badges) {
      const key = b.promotionId;
      if (!byPromo.has(key)) byPromo.set(key, []);
      byPromo.get(key)!.push(`${b.badge.code}`);
    }
    if (byPromo.size === 0) console.log("    (aucun)");
    for (const [pid, codes] of byPromo) {
      console.log(`    ${promoName.get(pid) ?? pid} : ${codes.length} → ${codes.join(", ")}`);
    }
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Échec :", e);
  process.exit(1);
});
