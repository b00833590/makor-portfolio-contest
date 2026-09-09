import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "", label: "Vue d'ensemble" },
  { href: "/classement", label: "Classement" },
  { href: "/statistiques", label: "Statistiques" },
  { href: "/reglement", label: "Règlement" },
];

const statusLabel: Record<string, string> = {
  [PromotionStatus.ACTIVE]: "En cours",
  [PromotionStatus.CLOSED]: "Terminé",
  [PromotionStatus.DRAFT]: "Brouillon",
};

export default async function DirecteurPromotionLayout({
  params,
  children,
}: {
  params: Promise<{ promotionId: string }>;
  children: React.ReactNode;
}) {
  const { promotionId } = await params;
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, name: true, status: true },
  });
  if (!promotion) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/directeur" className="text-sm text-muted-foreground hover:underline">
        ← Concours
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{promotion.name}</h1>
        <Badge variant={promotion.status === PromotionStatus.ACTIVE ? "default" : "secondary"}>
          {statusLabel[promotion.status]}
        </Badge>
      </div>
      <nav className="mt-4 flex flex-wrap gap-1 border-b border-border pb-3 text-sm font-medium">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={`/directeur/promotions/${promotionId}${item.href}`}
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
