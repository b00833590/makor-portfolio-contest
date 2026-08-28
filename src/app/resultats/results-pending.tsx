import Link from "next/link";
import type { UserRole } from "@/generated/prisma/enums";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

interface ResultsPendingProps {
  promotionName: string;
  userName: string;
  role: UserRole;
  avatarUrl: string | null;
}

/**
 * État d'attente de /resultats : la clôture est committée mais le classement
 * figé n'est pas encore écrit (finalisation concurrente ou interrompue).
 * Volontairement sans redirection vers /dashboard — celui-ci redirige vers
 * /resultats tant que les résultats ne sont pas vus, la paire bouclerait.
 */
export function ResultsPending({ promotionName, userName, role, avatarUrl }: ResultsPendingProps) {
  return (
    <>
      <SiteHeader name={userName} role={role} avatarUrl={avatarUrl} />
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-8 sm:px-6 sm:py-14">
        <p className="text-center text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          {promotionName}
        </p>
        <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          🏆 Concours terminé
        </h1>

        <Card className="mt-8 w-full">
          <CardHeader>
            <CardTitle className="text-center">Classement en cours de calcul</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Le classement final est en cours de calcul. Rechargez la page dans un instant.
            </p>
            <Link href="/resultats" className={buttonVariants({ variant: "outline" })}>
              Recharger
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
