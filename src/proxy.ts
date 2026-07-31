import { NextResponse } from "next/server";
import { auth } from "@/auth";

const protectedPrefixes = ["/dashboard", "/leaderboard", "/hall-of-fame", "/admin"];
const adminPrefixes = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAdminRoute = adminPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) return NextResponse.next();

  if (!req.auth?.user) {
    const signInUrl = new URL("/login", req.nextUrl);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAdminRoute && req.auth.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
