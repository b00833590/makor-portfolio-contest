import "server-only";
import { db } from "@/lib/db";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";

export interface ParticipantCreationInput {
  name: string;
}

export type ParticipantCreationResult =
  | { name: string; status: "created"; id: string; tempPassword: string }
  | { name: string; status: "exists" };

/**
 * Crée UN compte participant avec un mot de passe temporaire généré (jamais
 * choisi par l'admin) — `mustChangePassword: true` force le changement à la
 * première connexion (voir src/proxy.ts). Ne fait rien si l'identifiant existe
 * déjà. L'inscription à une promotion est une étape séparée : l'appelant
 * enchaîne `registerParticipants` (voir promotion-membership.ts).
 */
export async function createParticipantWithTempPassword(
  input: ParticipantCreationInput,
): Promise<ParticipantCreationResult> {
  const name = input.name.trim();
  const existing = await db.user.findUnique({ where: { name } });
  if (existing) return { name, status: "exists" };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await db.user.create({
    data: { name, passwordHash, mustChangePassword: true },
  });

  return { name, status: "created", id: user.id, tempPassword };
}
