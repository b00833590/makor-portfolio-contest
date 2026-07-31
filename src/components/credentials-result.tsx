"use client";

import { buildCredentialsMailto } from "@/lib/participants/credentials-mailto";

/** Affiche l'identifiant + mot de passe temporaire d'un compte qui vient d'être créé, avec un lien mailto optionnel. */
export function CredentialsResult({
  name,
  tempPassword,
  email,
}: {
  name: string;
  tempPassword: string;
  email?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <span>
        <strong>{name}</strong> — mot de passe temporaire :{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{tempPassword}</code>
      </span>
      {email && (
        <a
          href={buildCredentialsMailto({ email, name, tempPassword })}
          className="text-primary underline underline-offset-2 hover:no-underline"
        >
          Envoyer par email
        </a>
      )}
    </div>
  );
}
