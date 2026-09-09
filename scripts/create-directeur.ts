/**
 * Crée le compte Directeur de Stéphane Chouffan avec le mot de passe
 * temporaire littéral demandé ("1234") — sûr à relancer (idempotent, ne
 * touche à rien d'autre). Usage : npm run db:create-directeur
 *
 * Mot de passe volontairement littéral, pas généré : contrairement au reset
 * admin (voir admin/directeurs/actions.ts), c'est ici une valeur imposée le
 * temps des vérifications de l'admin — voir
 * docs/superpowers/specs/2026-09-09-directeur-role-design.md.
 *
 * N'importe pas de modules "server-only" (voir prisma/seed-admin.ts pour
 * l'explication) : bcryptjs est appelé directement ici plutôt que via
 * src/lib/auth/password.ts.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { UserRole } from "../src/generated/prisma/enums";

const DIRECTEUR_NAME = "Stéphane Chouffan";
const TEMP_PASSWORD = "1234";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const existing = await db.user.findUnique({ where: { name: DIRECTEUR_NAME } });
  if (existing) {
    console.log(`Le compte Directeur "${DIRECTEUR_NAME}" existe déjà — rien à faire.`);
    await db.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
  await db.user.create({
    data: { name: DIRECTEUR_NAME, passwordHash, role: UserRole.DIRECTEUR, mustChangePassword: true },
  });

  console.log(`Compte Directeur créé : identifiant "${DIRECTEUR_NAME}", mot de passe temporaire "${TEMP_PASSWORD}".`);
  console.log("Le changement de mot de passe sera imposé dès la première connexion.");

  await db.$disconnect();
}

main().catch((error) => {
  console.error("Échec de la création du compte Directeur :", error);
  process.exit(1);
});
