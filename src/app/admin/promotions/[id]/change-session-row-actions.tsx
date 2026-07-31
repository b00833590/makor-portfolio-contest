"use client";

import { useActionState, useState } from "react";
import { updateChangeSession, deleteChangeSession, type ChangeSessionFormState } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChangeSessionFormFields } from "./change-session-form-fields";

const initialState: ChangeSessionFormState = {};

export function ChangeSessionRowActions({
  promotionId,
  changeSessionId,
  weekNumber,
  opensAt,
  closesAt,
  maxChangesPerParticipant,
}: {
  promotionId: string;
  changeSessionId: string;
  weekNumber: number;
  opensAt: string;
  closesAt: string;
  maxChangesPerParticipant: number;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updateAction = updateChangeSession.bind(null, promotionId, changeSessionId);
  const [state, formAction, pending] = useActionState(updateAction, initialState);
  const [deletePending, setDeletePending] = useState(false);

  async function handleDelete() {
    setDeletePending(true);
    await deleteChangeSession(promotionId, changeSessionId);
    setDeletePending(false);
    setDeleteOpen(false);
  }

  return (
    <div className="flex gap-2">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Modifier
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la semaine {weekNumber}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="flex flex-wrap items-end gap-4">
            <ChangeSessionFormFields
              idPrefix="edit-"
              defaults={{ weekNumber, opensAt, closesAt, maxChangesPerParticipant }}
            />
            {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending}>
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
            <DialogTitle>Supprimer la semaine {weekNumber} ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Les transactions déjà passées pendant cette session sont conservées (juste détachées de la session).
            Seul le compteur de changements utilisés pour cette session sera supprimé.
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
