import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/participants", label: "Participants" },
  { href: "/admin/assets", label: "Univers d'actifs" },
  { href: "/admin/reglement", label: "Règlement" },
  { href: "/admin/audit", label: "Journal d'audit" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <>
      <SiteHeader name={session.user.name} role={session.user.role} />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Administration
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            Concours de portefeuille Makor
          </h1>
        </div>
        <nav className="flex gap-1 border-b border-border pb-4 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </>
  );
}
