"use client";

import { useActionState } from "react";
import { createAsset, type AssetFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { AssetFormFields } from "./asset-form-fields";

const initialState: AssetFormState = {};

export function AssetForm() {
  const [state, formAction, pending] = useActionState(createAsset, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4 rounded-xl border border-border p-6">
      <AssetFormFields />
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Ajouter l'actif"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
