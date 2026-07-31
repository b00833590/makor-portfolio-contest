"use client";

import { useActionState } from "react";
import { createAsset, type AssetFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: AssetFormState = {};

export function AssetForm() {
  const [state, formAction, pending] = useActionState(createAsset, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4 rounded-xl border border-border p-6">
      <div>
        <Label htmlFor="symbol">Symbole</Label>
        <Input id="symbol" name="symbol" required placeholder="AAPL" className="w-28 uppercase" />
      </div>
      <div>
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" required placeholder="Apple Inc." />
      </div>
      <div>
        <Label htmlFor="type">Type</Label>
        <Select name="type" required defaultValue="STOCK">
          <SelectTrigger id="type" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STOCK">Action</SelectItem>
            <SelectItem value="ETF">ETF</SelectItem>
            <SelectItem value="CRYPTO">Crypto</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="sector">Secteur</Label>
        <Input id="sector" name="sector" placeholder="Technologie" />
      </div>
      <div>
        <Label htmlFor="currency">Devise</Label>
        <Input id="currency" name="currency" defaultValue="EUR" className="w-20 uppercase" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Ajouter l'actif"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
