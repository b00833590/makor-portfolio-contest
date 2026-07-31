"use client";

import { useActionState, useState } from "react";
import { createTransaction, type TransactionFormState } from "./actions";
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
import { AssetSearchCombobox } from "@/app/dashboard/asset-search-combobox";
import type { AssetSearchResult } from "@/lib/assets/search-providers";
import { toParisDateTimeLocalValue } from "@/lib/timezone";

const initialState: TransactionFormState = {};

const typeOptions = [
  { value: "BUY", label: "Achat" },
  { value: "INCREASE", label: "Renforcement" },
  { value: "SELL_PARTIAL", label: "Vente partielle" },
  { value: "SELL_FULL", label: "Vente totale" },
  { value: "DECREASE", label: "Diminution" },
];

export function AddTransactionForm({ portfolioId }: { portfolioId: string }) {
  const action = createTransaction.bind(null, portfolioId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selected, setSelected] = useState<AssetSearchResult | null>(null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <div className="w-64">
        <Label htmlFor="add-tx-search">Actif</Label>
        <AssetSearchCombobox onSelect={setSelected} disabled={pending} />
        <input type="hidden" name="symbol" value={selected?.symbol ?? ""} />
        <input type="hidden" name="name" value={selected?.name ?? ""} />
        <input type="hidden" name="assetType" value={selected?.type ?? ""} />
        <input type="hidden" name="externalId" value={selected?.externalId ?? ""} />
        <input type="hidden" name="currency" value={selected?.currency ?? ""} />
        <input type="hidden" name="logoUrl" value={selected?.logoUrl ?? ""} />
      </div>
      <div>
        <Label htmlFor="add-tx-type">Type</Label>
        <Select name="type" required items={typeOptions} defaultValue="BUY">
          <SelectTrigger id="add-tx-type" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="add-tx-quantity">Quantité</Label>
        <Input id="add-tx-quantity" name="quantity" type="number" step="any" required className="w-32" />
      </div>
      <div>
        <Label htmlFor="add-tx-price">Prix unitaire (€)</Label>
        <Input id="add-tx-price" name="price" type="number" step="any" required className="w-32" />
      </div>
      <div>
        <Label htmlFor="add-tx-createdAt">Date et heure</Label>
        <Input
          id="add-tx-createdAt"
          name="createdAt"
          type="datetime-local"
          required
          defaultValue={toParisDateTimeLocalValue(new Date())}
        />
      </div>
      <Button type="submit" disabled={pending || !selected}>
        {pending ? "Ajout..." : "Ajouter la transaction"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
