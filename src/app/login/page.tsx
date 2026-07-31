import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

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
          Connectez-vous avec l&apos;identifiant et le mot de passe fournis par l&apos;administrateur.
        </p>
        <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
      </div>
    </div>
  );
}
