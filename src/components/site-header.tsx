"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { handleSignOut } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
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

const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Portefeuille" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SiteHeader({
  name,
  role,
}: {
  name: string;
  role: "ADMIN" | "PARTICIPANT";
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
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
            <Avatar className="size-8">
              <AvatarFallback className="bg-secondary text-xs font-medium">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="font-medium">{name}</p>
                <p className="text-xs font-normal text-muted-foreground">{role === "ADMIN" ? "Administrateur" : "Participant"}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
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
