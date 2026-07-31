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
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(50%_40%_at_50%_20%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent)]"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/20">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_theme(colors.primary)]" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Makor Concours
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Concours de portefeuille Makor
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connectez-vous avec votre compte Google Makor pour accéder à votre portefeuille.
        </p>
        <form action={signInWithGoogle} className="mt-6">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
          <Button type="submit" className="w-full">
            Se connecter avec Google
          </Button>
        </form>

        {devLoginEnabled && (
          <div className="mt-6 border-t border-border pt-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-500">
              Mode démonstration (dev uniquement)
            </p>
            <DevLoginSection accounts={demoAccounts} />
          </div>
        )}
      </div>
    </div>
  );
}
