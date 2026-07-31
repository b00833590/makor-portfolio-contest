import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { UserRole } from "@/generated/prisma/enums";

export const verifySession = cache(async () => {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
});

export const requireAdmin = cache(async () => {
  const session = await verifySession();
  if (session.user.role !== ("ADMIN" satisfies UserRole)) {
    redirect("/dashboard");
  }
  return session;
});
