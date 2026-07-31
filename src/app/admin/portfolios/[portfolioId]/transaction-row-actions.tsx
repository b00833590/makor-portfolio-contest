"use client";

import { useActionState, useState } from "react";
import { updateTransaction, deleteTransaction, type TransactionFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toParisDateTimeLocalValue } from "@/lib/timezone";

const initialState: TransactionFormState = {};

const typeOptions = [
  { value: "BUY", label: "Achat" },
  { value: "INCREASE", label: "Renforcement" },
  { value: "SELL_PARTIAL", label: "Vente partielle" },
  { value: "SELL_FULL", label: "Vente totale" },
  { value: "DECREASE", label: "Diminution" },
];

export function TransactionRowActions({
  portfolioId,
  transactionId,
  symbol,
  type,
  quantity,
  price,
  createdAt,
}: {
  portfolioId: string;
  transactionId: string;
  symbol: string;
  type: string;
  quantity: number;
  price: number;
  createdAt: Date;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updateAction = updateTransaction.bind(null, portfolioId, transactionId);
  const [state, formAction, pending] = useActionState(updateAction, initialState);
  const [deletePending, setDeletePending] = useState(false);

  async function handleDelete() {
    setDeletePending(true);
    await deleteTransaction(portfolioId, transactionId);
    setDeletePending(false);
    setDeleteOpen(false);
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Modifier
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la transaction — {symbol}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="flex flex-col gap-3">
            <div>
              <Label htmlFor={`edit-type-${transactionId}`}>Type</Label>
              <Select name="type" required items={typeOptions} defaultValue={type}>
                <SelectTrigger id={`edit-type-${transactionId}`} className="w-full">
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
              <Label htmlFor={`edit-quantity-${transactionId}`}>Quantité</Label>
              <Input
                id={`edit-quantity-${transactionId}`}
                name="quantity"
                type="number"
                step="any"
                required
                defaultValue={quantity}
              />
            </div>
            <div>
              <Label htmlFor={`edit-price-${transactionId}`}>Prix unitaire (€)</Label>
              <Input
                id={`edit-price-${transactionId}`}
                name="price"
                type="number"
                step="any"
                required
                defaultValue={price}
              />
            </div>
            <div>
              <Label htmlFor={`edit-createdAt-${transactionId}`}>Date et heure</Label>
              <Input
                id={`edit-createdAt-${transactionId}`}
                name="createdAt"
                type="datetime-local"
                required
                defaultValue={toParisDateTimeLocalValue(createdAt)}
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending} className="self-start">
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          Supprimer
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette transaction ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Le portefeuille sera automatiquement recalculé à partir de l&apos;historique restant.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" size="sm" disabled={deletePending} onClick={handleDelete}>
              {deletePending ? "Suppression..." : "Supprimer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
