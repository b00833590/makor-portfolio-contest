"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { avatarDataUrlSchema } from "./schema";

export interface AvatarFormState {
  error?: string;
}

function revalidateAvatarSurfaces() {
  revalidatePath("/profil");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/statistiques");
}

export async function updateAvatar(dataUrl: string): Promise<AvatarFormState> {
  const session = await verifySession();
  const parsed = avatarDataUrlSchema.safeParse(dataUrl);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Image invalide" };
  }

  await db.user.update({ where: { id: session.user.id }, data: { avatarUrl: parsed.data } });
  revalidateAvatarSurfaces();
  return {};
}

export async function removeAvatar(): Promise<AvatarFormState> {
  const session = await verifySession();
  await db.user.update({ where: { id: session.user.id }, data: { avatarUrl: null } });
  revalidateAvatarSurfaces();
  return {};
}
