import { NextResponse, type NextRequest } from "next/server";
import { getSessionGate } from "@/lib/auth/session";

const protectedPrefixes = ["/dashboard", "/leaderboard", "/hall-of-fame", "/resultats", "/admin", "/change-password"];
const adminPrefixes = ["/admin"];
const CHANGE_PASSWORD_PATH = "/change-password";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAdminRoute = adminPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) return NextResponse.next();

  const user = await getSessionGate();

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
  matcher: [
    {
      // Le prefetch Next.js (déclenché dès qu'un <Link> du header entre
      // dans le viewport, pas seulement au clic) traverse quand même
      // `proxy` par défaut — sans ce filtre, chaque page charge jusqu'à 6
      // requêtes Postgres de vérification de session (une par lien de
      // navigation jamais cliqué), en plus de celle de la page réellement
      // visitée. Sans risque : une requête de prefetch n'affiche jamais son
      // contenu à l'utilisateur, la vraie navigation (non-prefetch) qui
      // suivra passera normalement par ce même proxy.
      source: "/((?!api|_next/static|_next/image|.*\\.png$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
