import Link from "next/link";
import { requireAdmin } from "@/lib/dal";

const navItems = [
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/participants", label: "Participants" },
  { href: "/admin/assets", label: "Univers d'actifs" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Administration
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            Concours de portefeuille Makor
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{session.user.email}</p>
      </div>
      <nav className="flex gap-4 text-sm font-medium text-muted-foreground">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="hover:text-foreground">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
