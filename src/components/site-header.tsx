"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { handleSignOut } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavLink {
  href: string;
  label: string;
}

const participantNavLinks: NavLink[] = [
  { href: "/dashboard", label: "Portefeuille" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/statistiques", label: "Statistiques" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/reglement", label: "Règlement" },
];

// L'admin ne joue pas — pas de portefeuille, mais garde un œil sur le classement, les statistiques et le Hall of Fame.
const adminNavLinks: NavLink[] = [
  { href: "/leaderboard", label: "Classement" },
  { href: "/statistiques", label: "Statistiques" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
];

export function SiteHeader({
  name,
  role,
  avatarUrl = null,
}: {
  name: string;
  role: "ADMIN" | "PARTICIPANT";
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const homeHref = role === "ADMIN" ? "/admin" : "/dashboard";
  const navLinks = role === "ADMIN" ? adminNavLinks : participantNavLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href={homeHref} className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_theme(colors.primary)]" />
            <span className="text-base font-semibold tracking-tight">
              Makor <span className="text-muted-foreground font-normal">Concours</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            {role === "ADMIN" && (
              <Link
                href="/admin/promotions"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <UserAvatar name={name} avatarUrl={avatarUrl} className="size-8 text-xs" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="font-medium">{name}</p>
                <p className="text-xs font-normal text-muted-foreground">{role === "ADMIN" ? "Administrateur" : "Participant"}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profil" />}>Mon profil</DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/change-password" />}>
              Changer mon mot de passe
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void handleSignOut();
              }}
            >
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
