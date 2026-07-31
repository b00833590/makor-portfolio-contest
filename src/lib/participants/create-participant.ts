import "server-only";
import { db } from "@/lib/db";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";

export interface ParticipantCreationInput {
  name: string;
  promotionId: string | null;
}

export type ParticipantCreationResult =
  | { name: string; status: "created"; tempPassword: string }
  | { name: string; status: "exists" };

/**
 * Crée un participant avec un mot de passe temporaire généré (jamais choisi
 * par l'admin) — le compte a `mustChangePassword: true`, forçant le
 * changement de mot de passe à la première connexion (voir src/proxy.ts).
 * Ne fait rien si l'identifiant existe déjà (retourne "exists" plutôt que
 * d'écraser un compte existant).
 */
export async function createParticipantWithTempPassword(
  input: ParticipantCreationInput,
): Promise<ParticipantCreationResult> {
  const name = input.name.trim();
  const existing = await db.user.findUnique({ where: { name } });
  if (existing) return { name, status: "exists" };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await db.user.create({
    data: { name, passwordHash, promotionId: input.promotionId, mustChangePassword: true },
  });

  return { name, status: "created", tempPassword };
}
