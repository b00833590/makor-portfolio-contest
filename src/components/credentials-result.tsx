/** Affiche l'identifiant + mot de passe temporaire d'un compte qui vient d'être créé. */
export function CredentialsResult({ name, tempPassword }: { name: string; tempPassword: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <span>
        <strong>{name}</strong> — mot de passe temporaire :{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{tempPassword}</code>
      </span>
    </div>
  );
}
