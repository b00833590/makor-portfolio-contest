"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export interface LoginFormState {
  error?: string;
}

export async function login(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const name = formData.get("name");
  const password = formData.get("password");
  const callbackUrl = formData.get("callbackUrl");

  if (typeof name !== "string" || !name.trim() || typeof password !== "string" || !password) {
    return { error: "Identifiant et mot de passe requis." };
  }

  const user = await db.user.findUnique({ where: { name: name.trim() } });
  const isValid = user ? await verifyPassword(password, user.passwordHash) : false;

  // Message volontairement générique dans les deux cas (identifiant inconnu ou
  // mot de passe incorrect) — ne pas révéler si le compte existe.
  if (!user || !isValid) {
    return { error: "Identifiant ou mot de passe incorrect." };
  }

  await createSession(user.id);
  redirect(typeof callbackUrl === "string" && callbackUrl ? callbackUrl : "/dashboard");
}
