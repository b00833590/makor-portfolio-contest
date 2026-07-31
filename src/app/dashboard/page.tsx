import { verifySession } from "@/lib/dal";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function DashboardPage() {
  const session = await verifySession();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bienvenue, {session.user.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {session.user.email} · rôle {session.user.role}
          </p>
        </div>
        <form action={handleSignOut}>
          <Button variant="outline" type="submit">
            Se déconnecter
          </Button>
        </form>
      </div>
      <p className="mt-8 text-sm text-zinc-500">
        Le tableau de bord du portefeuille arrive en phase 2 (moteur de règles, achats/ventes).
      </p>
    </div>
  );
}
