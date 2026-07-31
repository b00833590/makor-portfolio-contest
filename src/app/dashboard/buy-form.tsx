"use client";

import { useActionState } from "react";
import { buyAsset, type TradeFormState } from "./actions";
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

const initialState: TradeFormState = {};

interface AssetOption {
  id: string;
  symbol: string;
  name: string;
}

export function BuyForm({ assets }: { assets: AssetOption[] }) {
  const [state, formAction, pending] = useActionState(buyAsset, initialState);

  if (assets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tous les actifs de l&apos;univers d&apos;investissement sont déjà dans votre portefeuille.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <div>
        <Label htmlFor="buy-assetId">Actif</Label>
        <Select name="assetId" required>
          <SelectTrigger id="buy-assetId" className="w-56">
            <SelectValue placeholder="Choisir un actif" />
          </SelectTrigger>
          <SelectContent>
            {assets.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>
                {asset.symbol} — {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="buy-amount">Montant (€)</Label>
        <Input id="buy-amount" name="amount" type="number" required className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Achat..." : "Acheter"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
