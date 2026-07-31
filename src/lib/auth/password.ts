import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Pas de 0/O/1/l/I : évite toute confusion à la recopie manuelle du mot de passe temporaire.
const TEMP_PASSWORD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

/**
 * Mot de passe temporaire lisible, généré par l'admin (jamais choisi par lui) —
 * l'utilisateur doit le changer dès sa première connexion (User.mustChangePassword).
 */
export function generateTempPassword(length = 10): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return result;
}
