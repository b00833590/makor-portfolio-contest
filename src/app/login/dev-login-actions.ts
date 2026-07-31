"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isDevLoginEnabled } from "@/lib/dev-login-constants";

// Doit rester synchronisé avec le nom de cookie utilisé par Auth.js en
// développement (session non "__Secure-" hors HTTPS). Sans incidence en
// production puisque isDevLoginEnabled() y renvoie toujours false.
const SESSION_COOKIE_NAME = "authjs.session-token";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface DevLoginFormState {
  error?: string;
}

export async function devLogin(
  _prevState: DevLoginFormState,
  formData: FormData,
): Promise<DevLoginFormState> {
  if (!isDevLoginEnabled()) {
    return { error: "La connexion de démonstration n'est pas activée sur cet environnement." };
  }

  const email = formData.get("email");
  if (typeof email !== "string" || !email) {
    return { error: "Email manquant." };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return { error: `Aucun utilisateur "${email}" — lancez d'abord npm run db:seed.` };
  }

  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);
  const sessionToken = randomUUID();
  await db.session.create({ data: { sessionToken, userId: user.id, expires } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  redirect("/dashboard");
}
