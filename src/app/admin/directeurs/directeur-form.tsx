"use client";

import { useActionState } from "react";
import { createDirecteur, type DirecteurFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CredentialsResult } from "@/components/credentials-result";

const initialState: DirecteurFormState = {};

export function DirecteurForm() {
  const [state, formAction, pending] = useActionState(createDirecteur, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-border p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="name">Identifiant (Prénom Nom)</Label>
          <Input id="name" name="name" required placeholder="Prénom Nom" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Création..." : "Créer le compte Directeur"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.created && <CredentialsResult name={state.created.name} tempPassword={state.created.tempPassword} />}
    </form>
  );
}
