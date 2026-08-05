"use client";

import { useActionState, useState } from "react";
import { updateAsset, toggleAssetActive, type AssetFormState } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssetFormFields } from "./asset-form-fields";

const initialState: AssetFormState = {};

export interface AssetRowActionsProps {
  assetId: string;
  symbol: string;
  name: string;
  type: "STOCK" | "CRYPTO";
  sector: string | null;
  currency: string;
  isActive: boolean;
}

export function AssetRowActions({ assetId, symbol, name, type, sector, currency, isActive }: AssetRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const updateAction = updateAsset.bind(null, assetId);
  const [state, formAction, pending] = useActionState(updateAction, initialState);

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Modifier
        </Button>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier {symbol}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="flex flex-wrap items-end gap-4">
            <AssetFormFields idPrefix="edit-" defaults={{ symbol, name, type, sector, currency }} />
            {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <form action={toggleAssetActive.bind(null, assetId, !isActive)}>
        <Button type="submit" variant="outline" size="sm">
          {isActive ? "Désactiver" : "Activer"}
        </Button>
      </form>
    </div>
  );
}
