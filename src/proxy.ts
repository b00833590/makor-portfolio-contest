import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

const protectedPrefixes = ["/dashboard", "/leaderboard", "/hall-of-fame", "/admin", "/change-password"];
const adminPrefixes = ["/admin"];
const CHANGE_PASSWORD_PATH = "/change-password";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAdminRoute = adminPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) return NextResponse.next();

  const user = await getCurrentUser();

  if (!user) {
    const signInUrl = new URL("/login", req.nextUrl);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Force le changement de mot de passe temporaire avant tout autre accès —
  // seule la page de changement de mot de passe elle-même y échappe.
  if (user.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, req.nextUrl));
  }

  if (isAdminRoute && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
