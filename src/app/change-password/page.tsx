import { verifySession } from "@/lib/dal";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await verifySession();

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
        <h1 className="text-xl font-semibold tracking-tight">Changer de mot de passe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session.user.mustChangePassword
            ? "Votre mot de passe est temporaire — choisissez-en un nouveau pour continuer."
            : "Choisissez un nouveau mot de passe."}
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
