"use client";

import { useActionState, useState } from "react";
import {
  reassignParticipantPromotion,
  removeParticipant,
  deleteParticipant,
  resetParticipantPassword,
  type ParticipantFormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CredentialsResult } from "@/components/credentials-result";

const initialState: ParticipantFormState = {};

interface PromotionOption {
  id: string;
  name: string;
}

export function ParticipantRowActions({
  userId,
  name,
  currentPromotionId,
  promotions,
}: {
  userId: string;
  name: string;
  currentPromotionId: string | null;
  promotions: PromotionOption[];
}) {
  const [open, setOpen] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(resetParticipantPassword, initialState);
  const [reassignState, reassignAction, reassignPending] = useActionState(
    reassignParticipantPromotion,
    initialState,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteParticipant(userId);
      setDeleteOpen(false);
    } catch {
      setDeleteError("La suppression a échoué. Réessayez.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Modifier</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le participant</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-6">
            <form action={reassignAction} className="flex flex-col gap-2">
              <input type="hidden" name="userId" value={userId} />
              <Label htmlFor={`promotion-${userId}`}>Promotion</Label>
              <Select
                name="promotionId"
                defaultValue={currentPromotionId ?? undefined}
                items={promotions.map((promotion) => ({ value: promotion.id, label: promotion.name }))}
              >
                <SelectTrigger id={`promotion-${userId}`} className="w-full">
                  <SelectValue placeholder="Choisir une promotion" />
                </SelectTrigger>
                <SelectContent>
                  {promotions.map((promotion) => (
                    <SelectItem key={promotion.id} value={promotion.id}>
                      {promotion.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={reassignPending} className="self-start">
                Changer de promotion
              </Button>
              {reassignState.error && <p className="text-sm text-destructive">{reassignState.error}</p>}
            </form>

            <form action={resetAction} className="flex flex-col gap-2 border-t border-border pt-4">
              <input type="hidden" name="userId" value={userId} />
              <Label>Mot de passe</Label>
              <p className="text-xs text-muted-foreground">
                Génère un nouveau mot de passe temporaire — {name} devra en choisir un nouveau à sa prochaine connexion.
              </p>
              <Button type="submit" size="sm" disabled={resetPending} className="self-start">
                {resetPending ? "Génération..." : "Réinitialiser le mot de passe"}
              </Button>
              {resetState.error && <p className="text-sm text-destructive">{resetState.error}</p>}
              {resetState.created && (
                <CredentialsResult name={resetState.created.name} tempPassword={resetState.created.tempPassword} />
              )}
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {currentPromotionId && (
        <form action={removeParticipant.bind(null, userId)}>
          <Button type="submit" variant="outline" size="sm">
            Retirer
          </Button>
        </form>
      )}

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
              Cette action est <strong className="text-destructive">définitive et irréversible</strong> : le compte,
              son historique de transactions et ses badges seront supprimés.
            </p>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
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
