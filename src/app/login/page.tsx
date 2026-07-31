import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { DEMO_EMAIL_DOMAIN, isDevLoginEnabled } from "@/lib/dev-login-constants";
import { Button } from "@/components/ui/button";
import { DevLoginSection } from "./dev-login-form";

async function signInWithGoogle(formData: FormData) {
  "use server";
  const callbackUrl = (formData.get("callbackUrl") as string) || "/dashboard";
  await signIn("google", { redirectTo: callbackUrl });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const devLoginEnabled = isDevLoginEnabled();

  const demoAccounts = devLoginEnabled
    ? await db.user.findMany({
        where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
        select: { email: true, name: true, role: true },
        orderBy: { role: "desc" },
      })
    : [];

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold tracking-tight">
          Concours de portefeuille Makor
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Connectez-vous avec votre compte Google Makor pour accéder à votre portefeuille.
        </p>
        <form action={signInWithGoogle} className="mt-6">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
          <Button type="submit" className="w-full">
            Se connecter avec Google
          </Button>
        </form>

        {devLoginEnabled && (
          <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-500">
              Mode démonstration (dev uniquement)
            </p>
            <DevLoginSection accounts={demoAccounts} />
          </div>
        )}
      </div>
    </div>
  );
}
