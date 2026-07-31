import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import type { UserRole } from "@/generated/prisma/enums";

export interface Session {
  user: SessionUser;
}

export const verifySession = cache(async (): Promise<Session> => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return { user };
});

export const requireAdmin = cache(async (): Promise<Session> => {
  const session = await verifySession();
  if (session.user.role !== ("ADMIN" satisfies UserRole)) {
    redirect("/dashboard");
  }
  return session;
});
