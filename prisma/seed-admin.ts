/**
 * Crée le compte administrateur par défaut si aucun n'existe déjà — sûr à
 * lancer en production (idempotent, ne touche à rien d'autre). C'est le seed
 * "essentiel" : sans lui, personne ne peut se connecter sur un déploiement
 * neuf. Usage : npm run db:seed
 *
 * N'importe pas les modules "server-only" (voir prisma/seed-demo.ts pour
 * l'explication) : bcryptjs est appelé directement ici plutôt que via
 * src/lib/auth/password.ts.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { UserRole } from "../src/generated/prisma/enums";

const DEFAULT_ADMIN_NAME = "Makor";
const DEFAULT_ADMIN_PASSWORD = "makor2023";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const existing = await db.user.findUnique({ where: { name: DEFAULT_ADMIN_NAME } });
  if (existing) {
    console.log(`Le compte admin "${DEFAULT_ADMIN_NAME}" existe déjà — rien à faire.`);
    await db.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  await db.user.create({
    data: { name: DEFAULT_ADMIN_NAME, passwordHash, role: UserRole.ADMIN },
  });

  console.log(`Compte admin créé : identifiant "${DEFAULT_ADMIN_NAME}", mot de passe "${DEFAULT_ADMIN_PASSWORD}".`);
  console.log("Pensez à changer ce mot de passe une fois connecté.");

  await db.$disconnect();
}

main().catch((error) => {
  console.error("Échec du seed admin :", error);
  process.exit(1);
});
