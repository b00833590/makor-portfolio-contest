import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { UserRole } from "@/generated/prisma/enums";

export const SESSION_COOKIE_NAME = "makor_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
}

export async function createSession(userId: string): Promise<void> {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({ data: { sessionToken, userId, expires } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Lit la session depuis le cookie et la vérifie en base ; supprime les sessions expirées. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;

  const session = await db.session.findUnique({
    where: { sessionToken },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  if (!session) return null;

  if (session.expires < new Date()) {
    await db.session.delete({ where: { sessionToken } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await db.session.delete({ where: { sessionToken } }).catch(() => {});
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
