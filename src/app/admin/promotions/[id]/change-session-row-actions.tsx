"use client";

import { useActionState, useState } from "react";
import { updateChangeSession, deleteChangeSession, type ChangeSessionFormState } from "./actions";
import { ChangeSessionKind } from "@/generated/prisma/enums";
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
  kind,
  label,
  opensAt,
  closesAt,
  maxChangesPerParticipant,
}: {
  promotionId: string;
  changeSessionId: string;
  kind: ChangeSessionKind;
  /** Libellé déjà formaté (ex. "la session du 10/08/2026 08:00 → 17:00") pour les titres de dialogue. */
  label: string;
  opensAt: string;
  closesAt: string;
  maxChangesPerParticipant: number;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updateAction = updateChangeSession.bind(null, promotionId, changeSessionId);
  const [state, formAction, pending] = useActionState(updateAction, initialState);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isInitializationWindow = kind === ChangeSessionKind.INITIALIZATION;

  async function handleDelete() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteChangeSession(promotionId, changeSessionId);
      setDeleteOpen(false);
    } catch {
      setDeleteError("La suppression a échoué. Réessayez.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Modifier
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier {label}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="flex flex-wrap items-end gap-4">
            <ChangeSessionFormFields
              idPrefix="edit-"
              defaults={{ opensAt, closesAt, maxChangesPerParticipant }}
              isInitializationWindow={isInitializationWindow}
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
            <DialogTitle>Supprimer {label} ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Les transactions déjà passées pendant cette session sont conservées (juste détachées de la session).
            Seul le compteur de changements utilisés pour cette session sera supprimé.
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
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
