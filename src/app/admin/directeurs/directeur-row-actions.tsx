"use client";

import { useActionState, useState } from "react";
import { resetDirecteurPassword, deleteDirecteur, type DirecteurFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CredentialsResult } from "@/components/credentials-result";

const initialState: DirecteurFormState = {};

export function DirecteurRowActions({ userId, name }: { userId: string; name: string }) {
  const [resetOpen, setResetOpen] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(resetDirecteurPassword, initialState);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteDirecteur(userId);
      setDeleteOpen(false);
    } catch {
      setDeleteError("La suppression a échoué. Réessayez.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Réinitialiser le mot de passe</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe de {name}</DialogTitle>
          </DialogHeader>
          <form action={resetAction} className="flex flex-col gap-2">
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
              Cette action est <strong className="text-destructive">définitive et irréversible</strong>.
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
