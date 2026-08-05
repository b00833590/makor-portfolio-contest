"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updatePromotion, deletePromotion, type PromotionFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const initialState: PromotionFormState = {};

export interface PromotionRowActionsProps {
  promotionId: string;
  name: string;
  participantCount: number;
  portfolioCount: number;
}

export function PromotionRowActions({
  promotionId,
  name,
  participantCount,
  portfolioCount,
}: PromotionRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updateAction = updatePromotion.bind(null, promotionId);
  const [state, formAction, pending] = useActionState(updateAction, initialState);
  const [deletePending, setDeletePending] = useState(false);

  async function handleDelete() {
    setDeletePending(true);
    await deletePromotion(promotionId);
    setDeletePending(false);
    setDeleteOpen(false);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/promotions/${promotionId}/parametres`} />}>
        Paramètres
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Modifier
        </Button>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier {name}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="edit-name">Nom de la promotion</Label>
              <Input id="edit-name" name="name" required placeholder="Promotion Été 2026" defaultValue={name} />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          Supprimer
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {name} ?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Cette action est <strong className="text-destructive">définitive et irréversible</strong>. Elle
              supprimera :
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              <li>les {portfolioCount} portefeuille(s) de cette promotion (positions, transactions, historique)</li>
              <li>toutes les sessions de changement de cette promotion</li>
              <li>les badges obtenus pendant cette promotion</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Les {participantCount} compte(s) participant(s) ne seront <strong>pas</strong> supprimés, seulement
              détachés de cette promotion.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" size="sm" disabled={deletePending} onClick={handleDelete}>
                {deletePending ? "Suppression..." : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
