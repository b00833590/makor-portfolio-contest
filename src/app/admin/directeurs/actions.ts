"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { createParticipantWithTempPassword } from "@/lib/participants/create-participant";
import { createDirecteurSchema, resetDirecteurPasswordSchema } from "./schema";

export interface DirecteurFormState {
  error?: string;
  created?: { name: string; tempPassword: string };
}

export async function createDirecteur(
  _prevState: DirecteurFormState,
  formData: FormData,
): Promise<DirecteurFormState> {
  const session = await requireAdmin();

  const parsed = createDirecteurSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const result = await createParticipantWithTempPassword({ name: parsed.data.name, role: "DIRECTEUR" });
  if (result.status === "exists") {
    return { error: `L'identifiant "${parsed.data.name}" est déjà utilisé.` };
  }

  await logAudit({
    adminId: session.user.id,
    action: "directeur.create",
    target: parsed.data.name,
  });

  revalidatePath("/admin/directeurs");
  return { created: { name: result.name, tempPassword: result.tempPassword } };
}

export async function resetDirecteurPassword(
  _prevState: DirecteurFormState,
  formData: FormData,
): Promise<DirecteurFormState> {
  const session = await requireAdmin();

  const parsed = resetDirecteurPasswordSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  let user;
  try {
    user = await db.user.update({
      where: { id: parsed.data.userId, role: "DIRECTEUR" },
      data: { passwordHash, mustChangePassword: true },
    });
  } catch {
    return { error: "Compte Directeur introuvable." };
  }
  await destroyAllSessionsForUser(parsed.data.userId);

  await logAudit({
    adminId: session.user.id,
    action: "directeur.reset-password",
    target: parsed.data.userId,
  });

  revalidatePath("/admin/directeurs");
  return { created: { name: user.name, tempPassword } };
}

export async function deleteDirecteur(userId: string): Promise<void> {
  const session = await requireAdmin();

  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (before.role !== "DIRECTEUR") {
    throw new Error("Ce compte n'est pas un compte Directeur.");
  }
  await db.user.delete({ where: { id: userId } });

  await logAudit({
    adminId: session.user.id,
    action: "directeur.delete",
    target: userId,
    before: { name: before.name },
  });

  revalidatePath("/admin/directeurs");
}
