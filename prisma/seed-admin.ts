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

const DEFAULT_ADMIN_NAME = process.env.ADMIN_INITIAL_NAME?.trim() || "Makor";

async function main() {
  // Aucun mot de passe par défaut : il doit être fourni explicitement à
  // l'exécution du seed. Un défaut codé en dur (et donc présent dans l'historique
  // git / la doc) permettrait à quiconque de se connecter avant l'admin légitime
  // sur un déploiement neuf et de s'approprier le compte via /change-password.
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword || initialPassword.length < 8) {
    console.error(
      "ADMIN_INITIAL_PASSWORD manquant ou trop court (8 caractères minimum).\n" +
        'Relancez avec : ADMIN_INITIAL_PASSWORD="<mot de passe fort>" npm run db:seed',
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const existing = await db.user.findUnique({ where: { name: DEFAULT_ADMIN_NAME } });
  if (existing) {
    console.log(`Le compte admin "${DEFAULT_ADMIN_NAME}" existe déjà — rien à faire.`);
    await db.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(initialPassword, 12);
  await db.user.create({
    data: { name: DEFAULT_ADMIN_NAME, passwordHash, role: UserRole.ADMIN, mustChangePassword: true },
  });

  console.log(`Compte admin créé : identifiant "${DEFAULT_ADMIN_NAME}".`);
  console.log("Le mot de passe est celui fourni via ADMIN_INITIAL_PASSWORD ; le changement sera imposé dès la première connexion.");

  await db.$disconnect();
}

main().catch((error) => {
  console.error("Échec du seed admin :", error);
  process.exit(1);
});
