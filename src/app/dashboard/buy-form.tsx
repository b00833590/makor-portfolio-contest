"use client";

import { useActionState, useState } from "react";
import { buyAsset, type TradeFormState } from "./actions";
import { useBadgeToast } from "./use-badge-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetSearchCombobox } from "./asset-search-combobox";
import type { AssetSearchResult } from "@/lib/assets/search-providers";

const initialState: TradeFormState = {};

export function BuyForm() {
  const [state, formAction, pending] = useActionState(buyAsset, initialState);
  const [selected, setSelected] = useState<AssetSearchResult | null>(null);
  useBadgeToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <div className="w-full sm:w-64">
        <Label htmlFor="buy-search">Actif</Label>
        <AssetSearchCombobox onSelect={setSelected} disabled={pending} />
        <input type="hidden" name="symbol" value={selected?.symbol ?? ""} />
        <input type="hidden" name="name" value={selected?.name ?? ""} />
        <input type="hidden" name="type" value={selected?.type ?? ""} />
        <input type="hidden" name="externalId" value={selected?.externalId ?? ""} />
        <input type="hidden" name="currency" value={selected?.currency ?? ""} />
        <input type="hidden" name="logoUrl" value={selected?.logoUrl ?? ""} />
      </div>
      <div className="w-full sm:w-auto">
        <Label htmlFor="buy-amount">Montant (€)</Label>
        <Input id="buy-amount" name="amount" type="number" required className="w-full sm:w-40" />
      </div>
      <Button type="submit" disabled={pending || !selected} className="w-full sm:w-auto">
        {pending ? "Achat..." : "Acheter"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
