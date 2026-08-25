"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { handleSignOut } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  { href: "/badges", label: "Badges" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/statistiques", label: "Statistiques" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/reglement", label: "Règlement" },
];

// L'admin ne joue pas — pas de portefeuille, pas de classement/stats personnels
// (voir les redirections dans leaderboard/page.tsx et statistiques/page.tsx) ;
// seul le Hall of Fame reste pertinent pour lui en dehors de l'espace admin.
const adminNavLinks: NavLink[] = [{ href: "/hall-of-fame", label: "Hall of Fame" }];

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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const isLinkActive = (href: string) => (href === "/admin/promotions" ? pathname.startsWith("/admin") : pathname === href);
  const allLinks = role === "ADMIN" ? [...navLinks, { href: "/admin/promotions", label: "Admin" }] : navLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-8">
          <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-2 size-10 sm:hidden"
                  aria-label="Ouvrir le menu de navigation"
                />
              }
            >
              <MenuIcon className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 max-w-[85vw]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1">
                {allLinks.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={<Link href={link.href} />}
                    className={cn(
                      "rounded-md px-3 py-3 text-base font-medium transition-colors",
                      isLinkActive(link.href)
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link href={homeHref} className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_theme(colors.primary)]" />
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              Makor <span className="text-muted-foreground font-normal">Concours</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isLinkActive(link.href)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
