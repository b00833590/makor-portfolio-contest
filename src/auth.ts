import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { UserRole } from "@/generated/prisma/enums";

function isAllowedDomain(email: string): boolean {
  const allowedDomain = process.env.AUTH_GOOGLE_HD;
  if (!allowedDomain) return true;
  return email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`);
}

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    Google({
      // Admins pre-provision participants by email (see admin/participants).
      // Safe here: single provider, domain-restricted, Google emails are verified.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) return false;
      if (profile?.email_verified === false) return false;
      return isAllowedDomain(user.email);
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role as UserRole;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.email && isAdminEmail(user.email)) {
        await db.user.update({
          where: { id: user.id },
          data: { role: UserRole.ADMIN },
        });
      }
    },
  },
});
