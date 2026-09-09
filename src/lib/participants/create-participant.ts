import "server-only";
import { db } from "@/lib/db";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import type { UserRole } from "@/generated/prisma/enums";

export interface ParticipantCreationInput {
  name: string;
  /** Rôle du compte créé — `PARTICIPANT` par défaut. Le seul autre appelant aujourd'hui est la création de comptes Directeur (voir admin/directeurs/actions.ts). */
  role?: UserRole;
}

export type ParticipantCreationResult =
  | { name: string; status: "created"; id: string; tempPassword: string }
  | { name: string; status: "exists" };

/**
 * Crée UN compte avec un mot de passe temporaire généré (jamais choisi par
 * l'admin) — `mustChangePassword: true` force le changement à la première
 * connexion (voir src/proxy.ts). Ne fait rien si l'identifiant existe déjà.
 * L'inscription à une promotion (participants uniquement) est une étape
 * séparée : l'appelant enchaîne `registerParticipants` (voir
 * promotion-membership.ts).
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
    data: { name, passwordHash, mustChangePassword: true, role: input.role ?? "PARTICIPANT" },
  });

  return { name, status: "created", id: user.id, tempPassword };
}
